// Temporary UI fixture server. Send "stop" on stdin to remove the whole schema.
const fs = require('node:fs');
const path = require('node:path');
process.env.ALLOWED_ORIGINS = 'http://127.0.0.1:5175,http://localhost:5175';
process.env.AUDIT_HTTP_PORT = '26165';
(async () => {
  const runtime = await require('./audit-runtime.cjs')('ui');
  const m = runtime.models;
  const department = await m.Department.create({ dept_name: 'UI audit department' });
  const sub = await m.SubHead.create({ code: '01', sub_group_name: 'UI audit subhead', department_id: department.dept_id });
  await m.Supplier.create({ PartyCode: 'UI/SUP/01', AccountName: 'UI audit supplier' });
  for (const [ItemCode, ItemName] of [['01/01/Ui/0001', 'UI audit slash item'], ['01/01/Ui/0002', 'UI transaction item']]) {
    await m.Item.create({ ItemCode, ItemName, DepartmentId: department.dept_id, SubHeadCode: sub.code, Quantity: 10, OpeningQty: 10, UnitRate: 12.5, UOM: 'NOS' });
  }
  await m.ItemMaster.create({ ItemCode: '01/01/Ui/0001', ItemName: 'UI audit GP slash item' });
  const po = await m.PurchaseOrder.create({ OrderNo: 1065, OrderDate: '2026-10-30', PartyCode: 'UI/SUP/01', Status: 'Completed', Total: 25, GrandTotal: 25, RoundOff: 0 });
  await m.PurchaseOrderDetail.create({ OrderNo: po.OrderNo, ItemCode: '01/01/Ui/0002', Qty: 2, UnitRate: 12.5, TotalAmount: 25, GrandTotal: 25 });
  const gi = await m.GateInward.create({ InwardNo: 1062, OrderNo: po.OrderNo, PartyCode: 'UI/SUP/01', InwardDate: '2026-10-30', InvoiceNo: 'UI-INV-1', InvoiceDate: '2026-10-30' });
  await m.GateInwardDetail.create({ InwardNo: gi.InwardNo, OrderNo: po.OrderNo, ItemCode: '01/01/Ui/0002', PendingQty: 2, ReceivedQty: 2, StockUnitRate: 12.5, StockValue: 25 });
  fs.writeFileSync(path.join(__dirname, 'ui-audit-session.json'), JSON.stringify({ base: runtime.base, database: runtime.database, username: 'audit_admin', password: runtime.password, itemCode: '01/01/Ui/0001' }, null, 2));
  console.log('UI_FIXTURE_READY ' + runtime.base);
  let closing = false;
  const close = async () => { if (closing) return; closing = true; await runtime.close(); console.log('UI_FIXTURE_REMOVED'); process.exit(0); };
  process.stdin.on('data', data => { if (String(data).trim() === 'stop') close(); });
  process.on('SIGINT', close); process.on('SIGTERM', close);
})().catch(e => { console.error(e); process.exitCode = 1; });
