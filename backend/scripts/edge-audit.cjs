const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const start = require('./audit-runtime.cjs');
const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (e) { results.push({ name, status: 'FAIL', error: e.message }); console.log('FAIL ' + name + ': ' + e.message); }
}
const clientError = res => assert.ok(res.status >= 400 && res.status < 500, JSON.stringify(res));
(async () => {
  const runtime = await start('edge');
  const { models: m, request } = runtime;
  try {
    const department = await m.Department.create({ dept_name: 'Edge department' });
    const subHead = await m.SubHead.create({ code: '01', sub_group_name: 'Edge subhead', department_id: department.dept_id });
    await m.Supplier.create({ PartyCode: 'EDGE', AccountName: 'Edge supplier' });
    await m.Item.create({ ItemCode: '00/01/Ed/0001', ItemName: 'Edge product', DepartmentId: department.dept_id, SubHeadCode: subHead.code, Quantity: 100, OpeningQty: 100, UnitRate: 10 });
    const itemCode = '00/01/Ed/0001';
    const masterCases = [
      ['items', m.Item, 'ItemCode', 'ItemName', { DepartmentId: department.dept_id, SubHeadCode: subHead.code }],
      ['item-masters', m.ItemMaster, 'ItemCode', 'ItemName', {}],
      ['suppliers', m.Supplier, 'PartyCode', 'AccountName', {}],
      ['parties', m.PartyMaster, 'Code', 'AccountName', {}],
      ['stores', m.StoreMaster, 'StoreCode', 'StoreName', {}],
      ['product-heads', m.ProductHead, 'ProdHeadCode', 'ProdHeadDesc', {}],
      ['sub-heads', m.SubHead, 'code', 'sub_group_name', { department_id: department.dept_id }],
      ['states', m.State, 'StateCode', 'StateName', {}]
    ];
    for (const [route, model, key, name, extra] of masterCases) {
      for (const code of ['00/1', '00%2F', 'A#?+&', '0012', '12', 'தமிழ்']) {
        await check(`${route} exact identity ${JSON.stringify(code)} edit/delete`, async () => {
          await model.create({ [key]: code, [name]: 'Before ' + route + ' ' + code, ...extra });
          const url = '/' + route + '?' + new URLSearchParams({ code });
          const edit = await request('PUT', url, { ...extra, [name]: 'After ' + route + ' ' + code });
          assert.equal(edit.status, 200, JSON.stringify(edit));
          assert.equal((await model.findByPk(code))[name], 'After ' + route + ' ' + code);
          const deletion = await request('DELETE', url);
          assert.equal(deletion.status, 200, JSON.stringify(deletion));
          assert.equal(await model.findByPk(code), null);
        });
      }
    }
    for (const query of [{ page: '-1' }, { limit: '-5' }, { page: 'abc' }, { limit: '1000000000' }]) {
      for (const route of ['/items', '/suppliers']) await check(`${route} rejects invalid pagination ${JSON.stringify(query)}`, async () => {
        clientError(await request('GET', route + '?' + new URLSearchParams(query)));
      });
    }
    for (const route of ['/reports/purchase/price-comparison', '/reports/receipt/item-wise', '/reports/billing/item-wise', '/reports/issue/item-wise']) {
      await check(`${route} accepts literal percent signs in filters without decoding twice`, async () => {
        const res = await request('GET', route + '?' + new URLSearchParams({ fromDate: '2026-10-01', toDate: '2026-10-31', items: '100% Belt', departments: '50% dept', parties: '50% supplier' }));
        assert.equal(res.status, 200, JSON.stringify(res));
      });
      await check(`${route} rejects invalid date ranges`, async () => {
        clientError(await request('GET', route + '?' + new URLSearchParams({ fromDate: '2026-02-31', toDate: '2026-01-01' })));
      });
    }
    for (const [route, model, key, name, extra] of masterCases) {
      for (const value of [5, {}, [], true, '   ', 'X'.repeat(300)]) await check(`${route} rejects invalid ${name} ${JSON.stringify(value).slice(0, 30)}`, async () => {
        const before = await model.count();
        const body = { [key]: 'TYPE_TEST', [name]: value, ...extra };
        clientError(await request('POST', '/' + route, body));
        assert.equal(await model.count(), before);
      });
      for (const body of [[], null, 'bad', 5]) await check(`${route} rejects malformed request body ${JSON.stringify(body)}`, async () => {
        clientError(await request('POST', '/' + route, body));
      });
    }
    const common = { PartyCode: 'EDGE', PartyName: 'Edge supplier', OrderDate: '2026-10-30', InwardDate: '2026-10-30', Total: 10, GrandTotal: 10 };
    let receiptCounter = 0;
    async function freshReceipt() {
      const receipt = await m.Receipt.create({ PartyCode: 'EDGE', InwardDate: '2026-10-30', InvoiceNo: 'EDGE' + ++receiptCounter });
      await m.ReceiptDetail.create({ GRNNo: receipt.GRNNo, ItemCode: itemCode, Qty: 1, UnitRate: 10 });
      return receipt.GRNNo;
    }
    const invalidQuantities = [-1, 'abc', 'Infinity', null, '', {}, []];
    for (const route of ['purchase-orders', 'receipts', 'bill-entries', 'item-issues', 'gate-pass-outs', 'gate-pass-ins']) {
      for (const quantity of invalidQuantities) await check(`${route} rejects invalid quantity ${JSON.stringify(quantity)}`, async () => {
        const order = await m.PurchaseOrder.create({ PartyCode: 'EDGE', OrderDate: '2026-10-30', Status: 'Completed' });
        await m.PurchaseOrderDetail.create({ OrderNo: order.OrderNo, ItemCode: itemCode, Qty: 1, UnitRate: 10 });
        const inward = await m.GateInward.create({ PartyCode: 'EDGE', OrderNo: order.OrderNo, InwardDate: '2026-10-30' });
        const body = { ...common, Department: department.dept_name, GateInwardNo: inward.InwardNo, GRNNo: await freshReceipt(), items: [{ OrderNo: order.OrderNo, ItemCode: itemCode, ItemName: 'Edge product', Qty: quantity, ReceivedQty: quantity, RecQty: quantity, UnitRate: 10 }] };
        const before = await Promise.all([m.PurchaseOrder.count(), m.Receipt.count(), m.BillEntry.count(), m.ItemIssue.count(), m.GatePassOut.count(), m.GatePassIn.count()]);
        clientError(await request('POST', '/' + route, body));
        const after = await Promise.all([m.PurchaseOrder.count(), m.Receipt.count(), m.BillEntry.count(), m.ItemIssue.count(), m.GatePassOut.count(), m.GatePassIn.count()]);
        assert.deepEqual(after, before);
      });
    }
    for (const route of ['purchase-orders', 'receipts', 'bill-entries', 'gate-inwards', 'item-issues', 'gate-pass-outs', 'gate-pass-ins']) {
      for (const items of [null, [], {}, 'bad', [null], [5]]) await check(`${route} rejects malformed item collection ${JSON.stringify(items)}`, async () => {
        const res = await request('POST', '/' + route, { ...common, Department: department.dept_name, GateInwardNo: 1, GRNNo: await freshReceipt(), items });
        clientError(res);
      });
    }
    // Discover all actual mounted write routes; every one must reject viewer/anonymous access.
    const source = runtime.serverSource;
    const imports = new Map([...source.matchAll(/const\s+(\w+)\s*=\s*require\(['"]\.\/routes\/([^'"]+)['"]\)/g)].map(x => [x[1], x[2]]));
    for (const mount of source.matchAll(/app\.use\(['"](\/api\/[^'"]+)['"]\s*,\s*([^;]+)\)/g)) {
      const name = [...imports.keys()].find(n => new RegExp('\\b' + n + '\\b').test(mount[2]));
      if (!name || mount[1] === '/api/auth') continue;
      for (const layer of require('../routes/' + imports.get(name)).stack) {
        if (!layer.route) continue;
        for (const method of ['post', 'put', 'delete', 'patch']) {
          if (!layer.route.methods[method]) continue;
          const route = mount[1].slice(4) + (layer.route.path === '/' ? '' : layer.route.path.replace(/:\w+/g, '1999999999'));
          for (const role of ['anonymous', 'viewer']) await check(`${role} cannot ${method.toUpperCase()} ${route}`, async () => {
            assert.equal((await request(method.toUpperCase(), route, {}, role)).status, role === 'viewer' ? 403 : 401);
          });
        }
      }
    }
    await check('HTTP login rejects wrong password, missing account, and inactive account', async () => {
      assert.equal((await request('POST', '/auth/login', { username: 'audit_admin', password: 'wrong' })).status, 401);
      assert.equal((await request('POST', '/auth/login', { username: 'nobody', password: 'wrong' })).status, 401);
      await m.User.update({ status: 'inactive' }, { where: { username: 'audit_operator' } });
      assert.equal((await request('POST', '/auth/login', { username: 'audit_operator', password: runtime.password })).status, 403);
      assert.equal((await request('GET', '/items', undefined, 'operator')).status, 403);
    });
    await check('Password change rejects wrong current password and persists a valid new password', async () => {
      assert.equal((await request('PUT', '/auth/change-password', { currentPassword: 'wrong', newPassword: 'New-pass-123', confirmPassword: 'New-pass-123' })).status, 400);
      assert.equal((await request('PUT', '/auth/change-password', { currentPassword: runtime.password, newPassword: 'New-pass-123', confirmPassword: 'different' })).status, 400);
      assert.equal((await request('PUT', '/auth/change-password', { currentPassword: runtime.password, newPassword: 'New-pass-123', confirmPassword: 'New-pass-123' })).status, 200);
      assert.equal((await request('POST', '/auth/login', { username: 'audit_admin', password: runtime.password })).status, 401);
      assert.equal((await request('POST', '/auth/login', { username: 'audit_admin', password: 'New-pass-123' })).status, 200);
    });
    const referencePO = await m.PurchaseOrder.create({ PartyCode: 'EDGE', OrderDate: '2026-10-30', Status: 'Completed' });
    await m.PurchaseOrderDetail.create({ OrderNo: referencePO.OrderNo, ItemCode: itemCode, Qty: 1, UnitRate: 10 });
    const referenceGI = await m.GateInward.create({ OrderNo: referencePO.OrderNo, PartyCode: 'EDGE', InwardDate: '2026-10-30' });
    await m.GateInwardDetail.create({ InwardNo: referenceGI.InwardNo, OrderNo: referencePO.OrderNo, ItemCode: itemCode, ReceivedQty: 1, StockUnitRate: 10, StockValue: 10 });
    const referenceReceipt = await m.Receipt.create({ GateInwardNo: referenceGI.InwardNo, PartyCode: 'EDGE', InwardDate: '2026-10-30' });
    await m.ReceiptDetail.create({ GRNNo: referenceReceipt.GRNNo, OrderNo: referencePO.OrderNo, ItemCode: itemCode, Qty: 1, UnitRate: 10 });
    const referenceBill = await m.BillEntry.create({ GRNNo: referenceReceipt.GRNNo, PartyCode: 'EDGE', GateInwardNo: referenceGI.InwardNo });
    const outgoing = await m.GatePassOut.create({ PartyName: 'Edge supplier', GpDate: '2026-10-30' });
    const incoming = await m.GatePassIn.create({ PartyName: 'Edge supplier', GiDate: '2026-10-30' });
    await m.GatePassInDetail.create({ InNo: incoming.InNo, GpNo: outgoing.GpNo, ItemName: 'Returned item', RecQty: 1 });
    for (const [route, model, id] of [
      ['/items?' + new URLSearchParams({ code: itemCode }), m.Item, itemCode],
      ['/suppliers?code=EDGE', m.Supplier, 'EDGE'],
      ['/departments/' + department.dept_id, m.Department, department.dept_id],
      ['/sub-heads?code=01', m.SubHead, '01'],
      ['/gate-inwards/' + referenceGI.InwardNo, m.GateInward, referenceGI.InwardNo],
      ['/receipts/' + referenceReceipt.GRNNo, m.Receipt, referenceReceipt.GRNNo],
      ['/gate-pass-outs/' + outgoing.GpNo, m.GatePassOut, outgoing.GpNo]
    ]) await check(`${route} cannot delete a record still referenced by transactions`, async () => {
      const res = await request('DELETE', route);
      assert.equal(res.status, 409, JSON.stringify(res));
      assert.ok(await model.findByPk(id));
    });
    for (const [route, layers] of [
      ['/bill-entries/delete-chain/' + referenceBill.VoucherNo, { bill: true, receipt: false, gateInward: true }],
      ['/bill-entries/delete-chain/' + referenceBill.VoucherNo, { bill: false, receipt: true }],
      ['/gate-inwards/delete-inward-chain/' + referenceGI.InwardNo, { gateInward: true }]
    ]) await check(`Cascade selection cannot leave dangling links ${route} ${JSON.stringify(layers)}`, async () => {
      assert.equal((await request('DELETE', route, { layers })).status, 409);
      assert.ok(await m.BillEntry.findByPk(referenceBill.VoucherNo));
      assert.ok(await m.Receipt.findByPk(referenceReceipt.GRNNo));
      assert.ok(await m.GateInward.findByPk(referenceGI.InwardNo));
    });
    await check('Concurrent receipts cannot duplicate the same purchase order', async () => {
      const order = await m.PurchaseOrder.create({ PartyCode: 'EDGE', OrderDate: '2026-10-30', Status: 'Completed' });
      await m.PurchaseOrderDetail.create({ OrderNo: order.OrderNo, ItemCode: itemCode, Qty: 1, UnitRate: 10 });
      const gi = await m.GateInward.create({ PartyCode: 'EDGE', OrderNo: order.OrderNo, InwardDate: '2026-10-30' });
      const body = { ...common, GateInwardNo: gi.InwardNo, items: [{ ItemCode: itemCode, OrderNo: order.OrderNo, Qty: 1, UnitRate: 10 }] };
      const res = await Promise.all([request('POST', '/receipts', body), request('POST', '/receipts', body)]);
      assert.equal(res.filter(r => r.status === 201).length, 1, JSON.stringify(res));
      assert.equal(await m.Receipt.count({ where: { GateInwardNo: gi.InwardNo } }), 1);
    });
    await check('Concurrent bills cannot duplicate the same GRN', async () => {
      const GRNNo = await freshReceipt();
      const body = { ...common, GRNNo, PartyBillNo: 'CONCURRENT', items: [{ ItemCode: itemCode, Qty: 1, UnitRate: 10 }] };
      const res = await Promise.all([request('POST', '/bill-entries', body), request('POST', '/bill-entries', body)]);
      assert.equal(res.filter(r => r.status === 201).length, 1, JSON.stringify(res));
      assert.equal(await m.BillEntry.count({ where: { GRNNo } }), 1);
    });
    await check('Optional blank purchase type remains valid when saving a bill', async () => {
      const GRNNo = await freshReceipt();
      const res = await request('POST', '/bill-entries', { ...common, GRNNo, PurchaseType: '', items: [{ ItemCode: itemCode, Qty: 1, UnitRate: 10 }] });
      assert.equal(res.status, 201, JSON.stringify(res));
    });
    await m.Supplier.create({ PartyCode: 'OTHER', AccountName: 'Other supplier' });
    await m.Item.create({ ItemCode: 'NOT_ON_GRN', ItemName: 'Unrelated product' });
    for (const [route, model, id] of [
      ['/receipts/' + referenceReceipt.GRNNo, m.Receipt, referenceReceipt.GRNNo],
      ['/bill-entries/' + referenceBill.VoucherNo, m.BillEntry, referenceBill.VoucherNo]
    ]) await check(`${route} rejects changing party away from its source document`, async () => {
      clientError(await request('PUT', route, { PartyCode: 'OTHER' }));
      assert.equal((await model.findByPk(id)).PartyCode, 'EDGE');
    });
    for (const [name, line] of [
      ['unrelated product', { ItemCode: 'NOT_ON_GRN', Qty: 1, UnitRate: 10 }],
      ['quantity above receipt', { ItemCode: itemCode, Qty: 2, UnitRate: 10 }]
    ]) await check(`Bill rejects ${name} outside its receipt`, async () => {
      const GRNNo = await freshReceipt();
      const res = await request('POST', '/bill-entries', { ...common, GRNNo, items: [line] });
      clientError(res);
      assert.equal(await m.BillEntry.count({ where: { GRNNo } }), 0);
    });
    await check('Removing an inward cannot make stock negative after its goods were issued', async () => {
      const code = 'NO_NEGATIVE_STOCK';
      await m.Item.create({ ItemCode: code, ItemName: 'Negative stock boundary', DepartmentId: department.dept_id, Quantity: 0, OpeningQty: 0, UnitRate: 10 });
      const order = await m.PurchaseOrder.create({ PartyCode: 'EDGE', OrderDate: '2026-10-30', Status: 'Draft' });
      await m.PurchaseOrderDetail.create({ OrderNo: order.OrderNo, ItemCode: code, Qty: 2, UnitRate: 10, TotalAmount: 20 });
      const gi = await request('POST', '/gate-inwards', { PartyCode: 'EDGE', InwardDate: '2026-10-30', items: [{ ItemCode: code, OrderNo: order.OrderNo, PendingQty: 2, ReceivedQty: 2 }] });
      assert.equal(gi.status, 201, JSON.stringify(gi));
      const issue = await request('POST', '/item-issues', { Department: department.dept_name, IssueDate: '2026-10-30', items: [{ ItemCode: code, Qty: 2 }] });
      assert.equal(issue.status, 201, JSON.stringify(issue));
      assert.equal((await request('PUT', '/gate-inwards/' + gi.body.data.InwardNo, { items: [{ ItemCode: code, OrderNo: order.OrderNo, PendingQty: 2, ReceivedQty: 2 }] })).status, 200);
      assert.equal((await request('DELETE', '/gate-inwards/' + gi.body.data.InwardNo)).status, 409);
      assert.equal(Number((await m.Item.findByPk(code)).Quantity), 0);
      assert.ok(await m.GateInward.findByPk(gi.body.data.InwardNo));
      assert.equal((await request('DELETE', '/item-issues/' + issue.body.data.IssueNo)).status, 200);
      assert.equal((await request('DELETE', '/gate-inwards/' + gi.body.data.InwardNo)).status, 200);
      assert.equal(Number((await m.Item.findByPk(code)).Quantity), 0);
    });
    await check('Editing an unchanged inward after a partial issue preserves remaining stock value', async () => {
      const code = 'PARTIAL_ISSUE_EDIT';
      await m.Item.create({ ItemCode: code, ItemName: 'Partial issue edit', DepartmentId: department.dept_id, Quantity: 0, OpeningQty: 0, UnitRate: 10 });
      const order = await m.PurchaseOrder.create({ PartyCode: 'EDGE', OrderDate: '2026-10-30', Status: 'Draft' });
      await m.PurchaseOrderDetail.create({ OrderNo: order.OrderNo, ItemCode: code, Qty: 2, UnitRate: 10, TotalAmount: 20 });
      const line = { ItemCode: code, OrderNo: order.OrderNo, PendingQty: 2, ReceivedQty: 2 };
      const gi = await request('POST', '/gate-inwards', { PartyCode: 'EDGE', InwardDate: '2026-10-30', items: [line] });
      assert.equal(gi.status, 201, JSON.stringify(gi));
      assert.equal((await request('POST', '/item-issues', { Department: department.dept_name, IssueDate: '2026-10-30', items: [{ ItemCode: code, Qty: 1 }] })).status, 201);
      const edit = await request('PUT', '/gate-inwards/' + gi.body.data.InwardNo, { items: [line] });
      assert.equal(edit.status, 200, JSON.stringify(edit));
      const stock = await m.Item.findByPk(code);
      assert.equal(Number(stock.Quantity), 1);
      assert.equal(Number(stock.UnitRate), 10);
    });
  } finally {
    await runtime.close();
    fs.writeFileSync(path.join(__dirname, 'edge-audit-results.json'), JSON.stringify({ scope: 'Real HTTP identity, numeric boundaries, malformed collections, all-route permissions, authentication', results }, null, 2));
  }
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`${results.length - failed} passed; ${failed} failed. Disposable database removed.`);
  if (failed) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
