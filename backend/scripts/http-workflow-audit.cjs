const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const start = require('./audit-runtime.cjs');
const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (e) { results.push({ name, status: 'FAIL', error: e.message }); console.log('FAIL ' + name + ': ' + e.message); }
}
(async () => {
  const runtime = await start('http');
  const { models: m, request } = runtime;
  const ids = {}, made = [];
  const details = { PurchaseOrder: ['PurchaseOrderDetail', 'OrderNo'], GateInward: ['GateInwardDetail', 'InwardNo'], Receipt: ['ReceiptDetail', 'GRNNo'], BillEntry: ['BillEntryDetail', 'VoucherNo'], ItemIssue: ['ItemIssueDetail', 'IssueNo'], GatePassOut: ['GatePassOutDetail', 'GpNo'], GatePassIn: ['GatePassInDetail', 'InNo'] };
  async function exercise(modelName, route, body, field) {
    const model = m[modelName], key = model.primaryKeyAttribute;
    let id;
    await check(`HTTP ${modelName} create persists header and every detail`, async () => {
      const res = await request('POST', route, body);
      assert.equal(res.status, 201, JSON.stringify(res));
      id = res.body.data[key]; ids[modelName] = id;
      assert.ok(await model.findByPk(id));
      if (details[modelName]) assert.equal(await m[details[modelName][0]].count({ where: { [key]: id } }), body.items.length);
    });
    if (id === undefined) return;
    const url = ['Item', 'ItemMaster', 'Supplier', 'PartyMaster', 'StoreMaster', 'ProductHead', 'SubHead', 'State'].includes(modelName)
      ? route + '?' + new URLSearchParams({ code: id }) : route + '/' + encodeURIComponent(id);
    made.push({ modelName, model, key, id, url });
    await check(`HTTP ${modelName} edit and reload persists fields and every detail`, async () => {
      const res = await request('PUT', url, { ...body, [field]: 'HTTP updated' });
      assert.equal(res.status, 200, JSON.stringify(res));
      assert.equal((await model.findByPk(id))[field], 'HTTP updated');
      if (details[modelName]) assert.equal(await m[details[modelName][0]].count({ where: { [key]: id } }), body.items.length);
      const list = await request('GET', route);
      assert.equal(list.status, 200, JSON.stringify(list));
      const rows = list.body.data;
      assert.ok(Array.isArray(rows));
      const row = rows.find(r => String(r[key]) === String(id));
      assert.ok(row, 'Saved record is missing from HTTP list');
      if (details[modelName]) assert.equal(row.details.length, body.items.length);
    });
    return id;
  }
  try {
    await exercise('Department', '/departments', { dept_name: 'HTTP department' }, 'dept_name');
    await exercise('SubHead', '/sub-heads', { sub_group_name: 'HTTP subhead', department_id: ids.Department }, 'sub_group_name');
    await exercise('UOM', '/uoms', { uom: 'HTTP NOS' }, 'uom');
    await exercise('State', '/states', { StateName: 'HTTP state' }, 'StateName');
    await exercise('StoreMaster', '/stores', { StoreCode: 'HTTP/01', StoreName: 'HTTP store' }, 'StoreName');
    await exercise('ProductHead', '/product-heads', { ProdHeadCode: 'HTTP/01', ProdHeadDesc: 'HTTP head' }, 'ProdHeadDesc');
    await exercise('Supplier', '/suppliers', { PartyCode: 'HTTP/01', AccountName: 'HTTP supplier' }, 'AccountName');
    await exercise('PartyMaster', '/parties', { Code: 'HTTP/01', AccountName: 'HTTP party' }, 'AccountName');
    await exercise('PurchaseType', '/purchase-types', { PurchaseType: 'HTTP type', Description: 'Original' }, 'Description');
    await exercise('ItemMaster', '/item-masters', { ItemCode: 'HTTP/01', ItemName: 'HTTP gate item', UnitRate: 10 }, 'ItemName');
    await exercise('Item', '/items', { ItemName: 'HTTP inventory item', DepartmentId: ids.Department, SubHeadCode: ids.SubHead, Quantity: 100, UnitRate: 10 }, 'Location');
    const item = await m.Item.findByPk(ids.Item);
    const line = { ItemCode: item.ItemCode, ItemName: item.ItemName, Qty: 2, UnitRate: 10, TotalAmount: 20, GrandTotal: 20, PendingQty: 2, ReceivedQty: 2 };
    const common = { PartyCode: ids.Supplier, PartyName: 'HTTP updated', Total: 20, GrandTotal: 20, items: [line] };
    await exercise('PurchaseOrder', '/purchase-orders', { ...common, OrderDate: '2026-10-30' }, 'Remarks');
    line.OrderNo = ids.PurchaseOrder;
    await exercise('GateInward', '/gate-inwards', { ...common, InwardDate: '2026-10-30', InvoiceNo: 'HTTP invoice' }, 'InvoiceNo');
    await check('HTTP gate inward updates physical stock once across create and edit', async () => {
      assert.equal(Number((await m.Item.findByPk(ids.Item)).Quantity), 102);
      assert.equal((await m.PurchaseOrder.findByPk(ids.PurchaseOrder)).Status, 'Completed');
    });
    await exercise('Receipt', '/receipts', { ...common, GateInwardNo: ids.GateInward, InwardDate: '2026-10-30' }, 'DCNo');
    await exercise('BillEntry', '/bill-entries', { ...common, GateInwardNo: ids.GateInward, GRNNo: ids.Receipt, PurchaseType: ids.PurchaseType, PartyBillNo: 'HTTP invoice' }, 'Narration');
    await exercise('BillVerify', '/bill-verify', { VoucherNo: ids.BillEntry, BillNo: 100, PartyName: 'HTTP updated', BillDate: '2026-10-30' }, 'Remarks');
    await exercise('ItemIssue', '/item-issues', { IssueDate: '2026-10-30', Department: 'HTTP updated', items: [{ ...line, Qty: 1 }] }, 'Remarks');
    await check('HTTP item issue edit deducts stock once', async () => assert.equal(Number((await m.Item.findByPk(ids.Item)).Quantity), 101));
    await exercise('GatePassOut', '/gate-pass-outs', { PartyName: 'HTTP updated', GpDate: '2026-10-30', items: [{ ItemName: 'HTTP gate item', Qty: 1 }] }, 'Remarks');
    await exercise('GatePassIn', '/gate-pass-ins', { PartyName: 'HTTP updated', GiDate: '2026-10-30', items: [{ ItemName: 'HTTP gate item', GpNo: ids.GatePassOut, PendingQty: 1, RecQty: 1 }] }, 'DcNo');
    await exercise('CancelOrder', '/cancel-orders', { OrderNo: ids.PurchaseOrder, PartyName: 'HTTP updated', CancelDate: '2026-10-30', Reason: 'Original' }, 'Reason');

    for (const [route, qtyField, valueField, qty, value] of [
      ['/reports/receipt/item-wise', 'reportTotalQty', 'reportGrandTotal', 2, 20],
      ['/reports/receipt/party-wise', 'reportTotalQty', 'reportGrandTotal', 2, 20],
      ['/reports/billing/item-wise', 'reportTotalQty', 'reportTotalAmount', 2, 20],
      ['/reports/billing/day-book', null, 'reportGrandTotal', null, 20],
      ['/reports/issue/item-wise', 'reportTotalQty', 'reportTotalValue', 1, 10]
    ]) await check(`${route} totals reconcile with the saved transaction`, async () => {
      const res = await request('GET', route + '?' + new URLSearchParams({ fromDate: '2026-10-30', toDate: '2026-10-30' }));
      assert.equal(res.status, 200, JSON.stringify(res));
      if (qtyField) assert.equal(res.body.data[qtyField], qty, JSON.stringify(res.body.data));
      assert.equal(res.body.data[valueField], value, JSON.stringify(res.body.data));
    });

    await check('Bulk upload generates distinct codes and reports rejected rows', async () => {
      const res = await request('POST', '/items/bulk-upload', { items: [
        { ItemName: 'CSV one', DepartmentId: ids.Department, SubHeadCode: ids.SubHead, Quantity: 1 },
        { ItemName: 'CSV two', DepartmentId: ids.Department, SubHeadCode: ids.SubHead, Quantity: 2 },
        { ItemName: 'Invalid CSV row', DepartmentId: 1999999999, SubHeadCode: ids.SubHead }
      ] });
      assert.equal(res.status, 200, JSON.stringify(res));
      assert.equal(res.body.uploaded, 2); assert.equal(res.body.failed, 1);
      const uploaded = await m.Item.findAll({ where: { ItemName: ['CSV one', 'CSV two'] } });
      assert.equal(new Set(uploaded.map(i => i.ItemCode)).size, 2);
    });
    await check('Item code generation skips sequence gaps and occupied codes', async () => {
      const prefix = `${ids.Department}/${ids.SubHead}/hu/`;
      for (const suffix of ['0001', '0003']) await m.ItemMaster.create({ ItemCode: prefix + suffix, ItemName: 'Sequence fixture' });
      const res = await request('POST', '/item-masters/generate-code', { departmentId: ids.Department, subHeadCode: ids.SubHead, departmentName: 'HTTP updated' });
      assert.equal(res.status, 200);
      assert.equal(await m.ItemMaster.findByPk(res.body.data.itemCode), null, 'Generator returned an occupied code');
    });
    for (const name of ['State', 'SubHead']) await check(`${name} sequential code generation crosses single-digit boundary`, async () => {
      for (let i = 0; i < 12; i++) {
        const res = await request('POST', name === 'State' ? '/states' : '/sub-heads', name === 'State' ? { StateName: 'Sequence state ' + i } : { sub_group_name: 'Sequence subhead ' + i, department_id: ids.Department });
        assert.equal(res.status, 201, JSON.stringify(res));
      }
    });
    for (const role of ['operator', 'manager']) await check(`${role} can perform authorized business CRUD`, async () => {
      const res = await request('POST', '/departments', { dept_name: role + ' test' }, role);
      assert.equal(res.status, 201, JSON.stringify(res));
      assert.equal((await request('DELETE', '/departments/' + res.body.data.dept_id, {}, role)).status, 200);
    });
    await check('Supplier form without a code receives a unique generated PartyCode', async () => {
      const responses = await Promise.all([request('POST', '/suppliers', { AccountName: 'Generated supplier one' }), request('POST', '/suppliers', { AccountName: 'Generated supplier two' })]);
      for (const response of responses) assert.equal(response.status, 201, JSON.stringify(response));
      assert.notEqual(responses[0].body.data.PartyCode, responses[1].body.data.PartyCode);
      assert.ok(responses.every(r => /^\d+$/.test(r.body.data.PartyCode)));
    });
    // Remove auxiliary fixtures before testing deletion of their parent masters.
    await m.Item.destroy({ where: { ItemName: ['CSV one', 'CSV two'] } });
    await m.SubHead.destroy({ where: { sub_group_name: { [require('sequelize').Op.like]: 'Sequence subhead %' } } });
    for (const entry of made.reverse()) await check(`HTTP ${entry.modelName} delete removes header and details`, async () => {
      const res = await request('DELETE', entry.url, {});
      assert.equal(res.status, 200, JSON.stringify(res));
      assert.equal(await entry.model.findByPk(entry.id), null);
      if (details[entry.modelName]) assert.equal(await m[details[entry.modelName][0]].count({ where: { [entry.key]: entry.id } }), 0);
    });
  } finally {
    await runtime.close();
    fs.writeFileSync(path.join(__dirname, 'http-workflow-audit-results.json'), JSON.stringify({ scope: 'Actual HTTP CRUD, list/reload and detail persistence for 20 modules, physical stock, bulk upload and numbering', results }, null, 2));
  }
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`${results.length - failed} passed; ${failed} failed. Disposable database removed.`);
  if (failed) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
