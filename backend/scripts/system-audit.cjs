// Isolated HTTP/read and transaction regression audit. No application records are changed.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true });
const results = [];
const respond = () => ({ statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } });
async function check(name, fn) {
  try { await fn(); results.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (e) { results.push({ name, status: 'FAIL', error: e.message }); console.log('FAIL ' + name + ': ' + e.message); }
}
(async () => {
  const database = 'stores_rehearsal_system_' + Date.now();
  const admin = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
  let sequelize, server, created = false;
  try {
    await admin.query(`CREATE DATABASE \`${database}\``);
    created = true;
    process.env.DB_NAME = database;
    const m = require('../models');
    ({ sequelize } = m);
    await sequelize.sync();
    const dept = await m.Department.create({ dept_name: 'Audit department' });
    const secondDept = await m.Department.create({ dept_name: 'Other department' });
    await m.Supplier.create({ PartyCode: 'AUD', AccountName: 'Audit supplier' });
    for (const code of ['A', 'B']) await m.Item.create({ ItemCode: code, ItemName: 'Same item name', DepartmentId: dept.dept_id, Quantity: 10, OpeningQty: 10, UnitRate: 5 });
    await m.Item.create({ ItemCode: 'C', ItemName: 'Other item', DepartmentId: secondDept.dept_id, Quantity: 10, OpeningQty: 10, UnitRate: 5 });
    await m.PurchaseOrder.create({ OrderNo: 1065, PartyCode: 'AUD', OrderDate: '2026-10-30', Status: 'Draft' });
    await m.PurchaseOrderDetail.create({ OrderNo: 1065, ItemCode: 'B', Qty: 10, UnitRate: 5 });
    const receipt = await m.Receipt.create({ PartyCode: 'AUD', InwardDate: '2026-10-30' });
    await m.ReceiptDetail.create({ GRNNo: receipt.GRNNo, OrderNo: 1065, ItemCode: 'B', Qty: 1, UnitRate: 5 });

    const bill = require('../controllers/billEntryController');
    await check('Bill rejects unresolved items without leaving a header', async () => {
      const before = await m.BillEntry.count();
      const res = respond();
      await bill.createBillEntry({ body: { PartyCode: 'AUD', GRNNo: receipt.GRNNo, items: [{ ItemName: 'DOES NOT EXIST', Qty: 1 }] } }, res);
      assert.equal(res.statusCode, 400);
      assert.equal(await m.BillEntry.count(), before);
    });
    // Remove any broken bill created by the pre-fix version, within this schema only.
    await m.BillEntryDetail.destroy({ where: {} }); await m.BillEntry.destroy({ where: {} });

    const fixtures = [
      { header: m.PurchaseOrder, detail: m.PurchaseOrderDetail, controller: require('../controllers/purchaseOrderController'), update: 'updatePurchaseOrder', param: 'orderNo', id: 1065, field: 'Remarks', body: { Remarks: 'must rollback', items: [{ ItemCode: 'B', Qty: 2, UnitRate: 5 }] } },
      { header: m.BillEntry, detail: m.BillEntryDetail, controller: bill, create: 'createBillEntry', update: 'updateBillEntry', param: 'voucherNo', field: 'Narration', body: { PartyCode: 'AUD', GRNNo: receipt.GRNNo, Narration: 'must rollback', items: [{ ItemCode: 'B', Qty: 1, UnitRate: 5 }] } },
      { header: m.GatePassOut, detail: m.GatePassOutDetail, controller: require('../controllers/gatePassOutController'), create: 'createGatePassOut', update: 'updateGatePassOut', param: 'gpNo', field: 'Remarks', body: { PartyName: 'Audit supplier', Remarks: 'must rollback', items: [{ ItemName: 'Gate item', Qty: 1 }] } },
      { header: m.GatePassIn, detail: m.GatePassInDetail, controller: require('../controllers/gatePassInController'), create: 'createGatePassIn', update: 'updateGatePassIn', param: 'inNo', field: 'DcNo', body: { PartyName: 'Audit supplier', DcNo: 'must rollback', items: [{ ItemName: 'Gate item', RecQty: 1 }] } }
    ];
    for (const f of fixtures) {
      const key = f.header.primaryKeyAttribute;
      if (f.create) {
        const res = respond();
        await f.controller[f.create]({ body: { ...f.body, [f.field]: 'original' } }, res);
        assert.equal(res.statusCode, 201, JSON.stringify(res.body));
        f.id = res.body.data[key];
      }
      const before = await f.header.findByPk(f.id, { raw: true });
      const detailBefore = await f.detail.findAll({ where: { [key]: f.id }, raw: true });
      await check(`${f.header.name} failed edit retains header and details`, async () => {
        f.detail.addHook('beforeCreate', 'auditFail', () => { throw new Error('Injected detail failure'); });
        const log = console.error; console.error = () => {};
        try {
          const res = respond();
          await f.controller[f.update]({ params: { [f.param]: f.id }, body: f.body }, res);
          assert.equal(res.statusCode, 500);
          assert.deepEqual(await f.header.findByPk(f.id, { raw: true }), before);
          assert.deepEqual(await f.detail.findAll({ where: { [key]: f.id }, raw: true }), detailBefore);
        } finally { f.detail.removeHook('beforeCreate', 'auditFail'); console.error = log; }
      });
      // Restore fixtures before the next scenario, even on a broken implementation.
      await f.header.update(before, { where: { [key]: f.id }, silent: true });
      await f.detail.destroy({ where: { [key]: f.id } });
      await f.detail.bulkCreate(detailBefore);
      if (f.create) await check(`${f.header.name} failed create leaves no partial record`, async () => {
        const beforeCount = await f.header.count();
        if (f.header === m.BillEntry) { await f.detail.destroy({ where: { [key]: f.id } }); await f.header.destroy({ where: { [key]: f.id } }); }
        const count = await f.header.count();
        f.detail.addHook('beforeCreate', 'auditFail', () => { throw new Error('Injected detail failure'); });
        const log = console.error; console.error = () => {};
        try {
          const res = respond(); await f.controller[f.create]({ body: f.body }, res);
          assert.equal(res.statusCode, 500);
          assert.equal(await f.header.count(), count, `header count was ${beforeCount} before setup`);
        } finally { f.detail.removeHook('beforeCreate', 'auditFail'); console.error = log; }
      });
    }

    const issueController = require('../controllers/itemIssueController');
    for (const action of ['delete', 'update']) await check(`Item issue ${action} restores the exact item code`, async () => {
      await m.Item.update({ Quantity: 10, OpeningQty: 10 }, { where: { ItemCode: ['A', 'B'] } });
      let res = respond();
      await issueController.createItemIssue({ body: { Department: dept.dept_name, IssueDate: '2026-10-30', items: [{ ItemCode: 'B', Qty: 2 }] } }, res);
      assert.equal(res.statusCode, 201, JSON.stringify(res.body));
      const id = res.body.data.IssueNo;
      res = respond();
      if (action === 'delete') await issueController.deleteItemIssue({ params: { issueNo: id } }, res);
      else await issueController.updateItemIssue({ params: { issueNo: id }, body: { Department: secondDept.dept_name, items: [{ ItemCode: 'C', Qty: 1 }] } }, res);
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      assert.equal(Number((await m.Item.findByPk('A')).Quantity), 10);
      assert.equal(Number((await m.Item.findByPk('B')).Quantity), 10);
    });

    const inwardController = require('../controllers/gateInwardController');
    await check('Gate inward rejects quantities above actual pending balance', async () => {
      const res = respond();
      await inwardController.createGateInward({ body: { PartyCode: 'AUD', items: [{ OrderNo: 1065, ItemCode: 'B', PendingQty: 999, ReceivedQty: 11 }] } }, res);
      assert.equal(res.statusCode, 400, JSON.stringify(res.body));
    });
    await check('Gate inward rejects duplicate-line overflow and items outside the PO', async () => {
      for (const items of [
        [{ OrderNo: 1065, ItemCode: 'B', PendingQty: 999, ReceivedQty: 6 }, { OrderNo: 1065, ItemCode: 'B', PendingQty: 999, ReceivedQty: 6 }],
        [{ OrderNo: 1065, ItemCode: 'A', PendingQty: 999, ReceivedQty: 1 }]
      ]) {
        const res = respond(); await inwardController.createGateInward({ body: { PartyCode: 'AUD', items } }, res);
        assert.equal(res.statusCode, 400, JSON.stringify(res.body));
      }
    });
    await check('Same-PO invoice batches can be edited and exclude their own received quantity', async () => {
      const ids = [];
      for (const qty of [4, 6]) {
        const res = respond();
        await inwardController.createGateInward({ body: { PartyCode: 'AUD', InvoiceNo: 'SPLIT-INVOICE', items: [{ OrderNo: 1065, ItemCode: 'B', PendingQty: 999, ReceivedQty: qty }] } }, res);
        assert.equal(res.statusCode, 201, JSON.stringify(res.body)); ids.push(res.body.data.InwardNo);
      }
      let res = respond();
      await inwardController.updateGateInward({ params: { inwardNo: ids[0] }, body: { InvoiceNo: 'SPLIT-INVOICE', items: [{ OrderNo: 1065, ItemCode: 'B', PendingQty: 999, ReceivedQty: 4 }] } }, res);
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      res = respond();
      await inwardController.updateGateInward({ params: { inwardNo: ids[0] }, body: { items: [{ OrderNo: 1065, ItemCode: 'B', PendingQty: 999, ReceivedQty: 5 }] } }, res);
      assert.equal(res.statusCode, 400);
      for (const inwardNo of ids) await inwardController.deleteGateInward({ params: { inwardNo } }, respond());
    });
    await check('Concurrent gate inwards cannot receive the same pending balance twice', async () => {
      const responses = [respond(), respond()];
      await Promise.all(responses.map(res => inwardController.createGateInward({ body: { PartyCode: 'AUD', items: [{ OrderNo: 1065, ItemCode: 'B', PendingQty: 10, ReceivedQty: 10 }] } }, res)));
      assert.deepEqual(responses.map(r => r.statusCode).sort(), [201, 400]);
      const total = await m.GateInwardDetail.sum('ReceivedQty', { where: { OrderNo: 1065 } });
      assert.equal(Number(total), 10);
    });
    await check('Purchase order save preserves the submitted summary rounding', async () => {
      const controller = require('../controllers/purchaseOrderController');
      const body = { PartyCode: 'AUD', OrderDate: '2026-10-30', RoundOff: 0, GrandTotal: 100.49, items: [{ ItemCode: 'B', Qty: 1, UnitRate: 100.49, TotalAmount: 100.49, GrandTotal: 100 }] };
      const created = respond(); await controller.createPurchaseOrder({ body }, created);
      assert.equal(created.statusCode, 201, JSON.stringify(created.body));
      const id = created.body.data.OrderNo;
      assert.equal(Number((await m.PurchaseOrder.findByPk(id)).GrandTotal), 100.49);
      const edited = respond(); await controller.updatePurchaseOrder({ params: { orderNo: id }, body }, edited);
      assert.equal(edited.statusCode, 200, JSON.stringify(edited.body));
      assert.equal(Number((await m.PurchaseOrder.findByPk(id)).GrandTotal), 100.49);
    });
    for (const mode of ['purchaseOrder', 'billChain', 'failedBillChain']) await check(`${mode} deletion preserves stock value and transaction consistency`, async () => {
      await m.Item.update({ Quantity: 10, OpeningQty: 10, UnitRate: 5 }, { where: { ItemCode: 'B' } });
      const order = await m.PurchaseOrder.create({ PartyCode: 'AUD', OrderDate: '2026-10-30', Status: 'Draft' });
      await m.PurchaseOrderDetail.create({ OrderNo: order.OrderNo, ItemCode: 'B', Qty: 2, UnitRate: 20, TotalAmount: 40 });
      const giRes = respond();
      await inwardController.createGateInward({ body: { PartyCode: 'AUD', items: [{ OrderNo: order.OrderNo, ItemCode: 'B', PendingQty: 2, ReceivedQty: 2 }] } }, giRes);
      assert.equal(giRes.statusCode, 201, JSON.stringify(giRes.body));
      const inwardNo = giRes.body.data.InwardNo;
      const grn = await m.Receipt.create({ PartyCode: 'AUD', GateInwardNo: inwardNo, InwardDate: '2026-10-30' });
      await m.ReceiptDetail.create({ GRNNo: grn.GRNNo, OrderNo: order.OrderNo, ItemCode: 'B', Qty: 2, UnitRate: 20 });
      const billRes = respond();
      await bill.createBillEntry({ body: { PartyCode: 'AUD', GateInwardNo: inwardNo, GRNNo: grn.GRNNo, items: [{ ItemCode: 'B', Qty: 2, UnitRate: 20 }] } }, billRes);
      assert.equal(billRes.statusCode, 201, JSON.stringify(billRes.body));
      const voucherNo = billRes.body.data.VoucherNo;
      const verification = await m.BillVerify.create({ VoucherNo: voucherNo, BillNo: 1, PartyName: 'AUD', BillDate: '2026-10-30' });
      if (mode === 'failedBillChain') m.GateInward.addHook('beforeDestroy', 'auditDeleteFail', () => { throw new Error('Injected chain failure'); });
      const log = console.error; console.error = () => {};
      const res = respond();
      try {
        if (mode === 'purchaseOrder') await require('../controllers/purchaseOrderController').deletePurchaseOrder({ params: { orderNo: order.OrderNo } }, res);
        else await bill.deleteBillChain({ params: { voucherNo }, body: { layers: { bill: true, receipt: true, gateInward: true, purchaseOrder: true } } }, res);
      } finally { m.GateInward.removeHook('beforeDestroy', 'auditDeleteFail'); console.error = log; }
      const stock = await m.Item.findByPk('B');
      if (mode === 'failedBillChain') {
        assert.equal(res.statusCode, 500);
        assert.ok(await m.BillEntry.findByPk(voucherNo));
        assert.ok(await m.BillVerify.findByPk(verification.VerifyNo));
        assert.ok(await m.Receipt.findByPk(grn.GRNNo));
        assert.ok(await m.GateInward.findByPk(inwardNo));
        assert.equal(await m.BillEntryDetail.count({ where: { VoucherNo: voucherNo } }), 1);
        assert.equal(Number(stock.Quantity), 12);
        assert.equal(Number(stock.UnitRate), 7.5);
      } else {
        assert.equal(res.statusCode, 200, JSON.stringify(res.body));
        assert.equal(Number(stock.Quantity), 10);
        assert.equal(Number(stock.UnitRate), 5);
        assert.equal(await m.PurchaseOrder.findByPk(order.OrderNo), null);
        assert.equal(await m.GateInward.findByPk(inwardNo), null);
        assert.equal(await m.Receipt.findByPk(grn.GRNNo), null);
        assert.equal(await m.BillEntry.findByPk(voucherNo), null);
        assert.equal(await m.BillVerify.findByPk(verification.VerifyNo), null);
      }
    });

    await check('Deleting either PO in a shared inward cannot delete the other PO goods', async () => {
      const orders = [];
      for (let i = 0; i < 2; i++) {
        const order = await m.PurchaseOrder.create({ PartyCode: 'AUD', OrderDate: '2026-10-30' });
        orders.push(order.OrderNo);
        await m.PurchaseOrderDetail.create({ OrderNo: order.OrderNo, ItemCode: 'B', Qty: 1, UnitRate: 5 });
      }
      const gi = await m.GateInward.create({ OrderNo: orders[0], PartyCode: 'AUD', InwardDate: '2026-10-30' });
      for (const OrderNo of orders) await m.GateInwardDetail.create({ InwardNo: gi.InwardNo, OrderNo, ItemCode: 'B', ReceivedQty: 1, StockUnitRate: 5, StockValue: 5 });
      for (const orderNo of orders) {
        const res = respond(); await require('../controllers/purchaseOrderController').deletePurchaseOrder({ params: { orderNo } }, res);
        assert.equal(res.statusCode, 409, JSON.stringify(res.body));
        assert.equal(await m.GateInwardDetail.count({ where: { InwardNo: gi.InwardNo } }), 2);
      }
    });

    // Load the actual Express configuration without invoking startup/sync/initAdmin.
    const serverPath = path.resolve(__dirname, '../server.js');
    const source = fs.readFileSync(serverPath, 'utf8');
    assert.ok(/startServer\(\);\s*$/.test(source));
    const loaded = new Module(serverPath, module);
    loaded.filename = serverPath; loaded.paths = Module._nodeModulePaths(path.dirname(serverPath));
    loaded._compile(source.replace(/startServer\(\);\s*$/, 'module.exports = app;'), serverPath);
    server = loaded.exports.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const password = 'Temporary-audit-password-123';
    const bcrypt = require('bcryptjs');
    await m.User.create({ username: 'audit_admin', password: await bcrypt.hash(password, 4), role: 'admin' });
    let token;
    await check('HTTP login and authenticated profile', async () => {
      const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'audit_admin', password }) });
      assert.equal(login.status, 200); token = (await login.json()).token; assert.ok(token);
      const profile = await fetch(base + '/api/auth/me', { headers: { Authorization: 'Bearer ' + token } });
      assert.equal(profile.status, 200);
    });
    await check('HTTP rejects anonymous and invalid-token business access', async () => {
      for (const headers of [{}, { Authorization: 'Bearer invalid' }]) assert.equal((await fetch(base + '/api/items', { headers })).status, 401);
    });
    for (const [collection, model] of [['items', m.Item], ['item-masters', m.ItemMaster]]) {
      await check(`HTTP ${collection} edit/delete retains slash, percent, and leading-zero codes`, async () => {
        const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
        const codes = ['11/05/Ge/0001', '000123', '123', 'A#?%2F+ &', 'A/B%literal'];
        for (const code of codes) await model.create({ ItemCode: code, ItemName: 'URL identity test', Quantity: 7, OpeningQty: 7 });
        for (const code of codes) {
          const url = base + '/api/' + collection + '?' + new URLSearchParams({ code });
          const edited = await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ ItemName: 'Updated ' + code, Quantity: 999 }) });
          assert.equal(edited.status, 200, await edited.text());
          const saved = await model.findByPk(code);
          assert.equal(saved.ItemName, 'Updated ' + code);
          if (collection === 'items') assert.equal(Number(saved.Quantity), 7);
          const deleted = await fetch(url, { method: 'DELETE', headers });
          assert.equal(deleted.status, 200, await deleted.text());
          assert.equal(await model.findByPk(code), null);
        }
        for (const method of ['PUT', 'DELETE']) {
          const res = await fetch(base + '/api/' + collection, { method, headers, body: method === 'PUT' ? '{}' : undefined });
          assert.equal(res.status, 400);
        }
        // Existing encoded-path API callers still work and decode exactly once.
        const code = 'OLD/%2F';
        await model.create({ ItemCode: code, ItemName: 'Legacy URL' });
        const legacy = base + '/api/' + collection + '/' + encodeURIComponent(code);
        assert.equal((await fetch(legacy, { method: 'PUT', headers, body: JSON.stringify({ ItemName: 'Legacy updated' }) })).status, 200);
        assert.equal((await fetch(legacy, { method: 'DELETE', headers })).status, 200);
      });
    }
    await check('HTTP viewer can read but cannot modify business data', async () => {
      const viewer = await m.User.create({ username: 'audit_viewer', password: await bcrypt.hash(password, 4), role: 'viewer' });
      const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: viewer.username, password }) });
      const viewerToken = (await login.json()).token;
      const headers = { Authorization: 'Bearer ' + viewerToken, 'Content-Type': 'application/json' };
      assert.equal((await fetch(base + '/api/items', { headers })).status, 200);
      for (const [method, url, body] of [
        ['POST', '/api/departments', { dept_name: 'Viewer must not create' }],
        ['PUT', '/api/departments/' + dept.dept_id, { dept_name: 'Viewer must not edit' }],
        ['DELETE', '/api/departments/' + secondDept.dept_id, {}]
      ]) assert.equal((await fetch(base + url, { method, headers, body: JSON.stringify(body) })).status, 403);
    });
    const imports = new Map([...source.matchAll(/const\s+(\w+)\s*=\s*require\(['"]\.\/routes\/([^'"]+)['"]\)/g)].map(x => [x[1], x[2]]));
    for (const mount of source.matchAll(/app\.use\(['"](\/api\/[^'"]+)['"]\s*,\s*([^;]+)\)/g)) {
      const name = [...imports.keys()].find(n => new RegExp('\\b' + n + '\\b').test(mount[2]));
      if (!name) continue;
      const router = require('../routes/' + imports.get(name));
      for (const layer of router.stack) {
        if (!layer.route?.methods.get || layer.route.path.includes(':')) continue;
        const url = mount[1] + (layer.route.path === '/' ? '' : layer.route.path);
        await check('HTTP GET ' + url, async () => {
          const qs = new URLSearchParams({ fromDate: '2026-10-01', toDate: '2026-10-31', partyCode: 'AUD', orderNo: '1065', inwardNo: '1999999999', grnNo: String(receipt.GRNNo), department: dept.dept_name });
          const res = await fetch(base + url + '?' + qs, { headers: { Authorization: 'Bearer ' + token } });
          const body = await res.text();
          assert.ok(res.status < 500, res.status + ' ' + body.slice(0, 300));
          if (url === '/api/reports/stock/department-wise') {
            // A fresh schema has no verified migration opening-balance ledger.
            assert.equal(res.status, 422);
            assert.match(body, /Verified historical opening balances/);
          } else if (url.startsWith('/api/reports/')) assert.equal(res.status, 200, body.slice(0, 300));
        });
      }
    }
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE \`${database}\``);
    await admin.end();
    fs.writeFileSync(path.join(__dirname, 'system-audit-results.json'), JSON.stringify({ database, results }, null, 2));
  }
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`${results.length - failed} passed; ${failed} failed. Disposable database removed.`);
  if (failed) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
