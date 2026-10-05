// Read-only audit. Run from backend with DB_HOST/DB_PORT set for the target.
const db = require('../config/db');

async function main() {
  const [server] = await db.query('SELECT DATABASE() AS db, VERSION() AS version, @@port AS port');
  console.log('server', JSON.stringify(server));
  for (const table of ['items', 'receipts', 'receipt_details', 'purchase_order_details', 'item_issue_details', 'item_issues']) {
    const [columns] = await db.query(`SHOW COLUMNS FROM ${table}`);
    console.log(table, JSON.stringify(columns.map(column => ({ name: column.Field, type: column.Type }))));
  }
  for (const [name, sql] of Object.entries({
    receipts: `SELECT COUNT(*) AS lineCount, SUM(rd.Qty) AS qty, SUM(rd.TotalAmount) AS gross
      FROM receipt_details rd JOIN receipts r ON r.GRNNo = rd.GRNNo
      WHERE r.InwardDate >= '2026-08-01' AND r.InwardDate < '2026-09-01'`,
    issues: `SELECT COUNT(*) AS lineCount, SUM(d.Qty) AS qty
      FROM item_issue_details d JOIN item_issues h ON h.IssueNo = d.IssueNo
      WHERE h.IssueDate >= '2026-08-01' AND h.IssueDate < '2026-09-01'`,
    duplicates: `SELECT COUNT(*) AS groupsCount, SUM(copies - 1) AS surplusRows,
      SUM((copies - 1) * Qty) AS surplusQty, SUM((copies - 1) * TotalAmount) AS surplusGross
      FROM (SELECT rd.GRNNo, rd.OrderNo, rd.ItemCode, rd.Qty, rd.UnitRate, rd.TotalAmount, COUNT(*) AS copies
        FROM receipt_details rd JOIN receipts r ON r.GRNNo = rd.GRNNo
        WHERE r.InwardDate >= '2026-08-01' AND r.InwardDate < '2026-09-01'
        GROUP BY rd.GRNNo, rd.OrderNo, rd.ItemCode, rd.Qty, rd.UnitRate, rd.TotalAmount HAVING COUNT(*) > 1) d`
  })) {
    const [rows] = await db.query(sql);
    console.log(name, JSON.stringify(rows));
  }
  const controller = require('../controllers/reportController');
  const response = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { console.log('receiptReport', JSON.stringify({
      status: this.statusCode || 200, success: payload.success,
      gross: payload.data?.reportTotalAmount, net: payload.data?.reportGrandTotal,
      items: payload.data?.items, error: payload.error
    })); }
  };
  await controller.getDepartmentWiseReceiptRegister({ query: { fromDate: '2026-08-01', toDate: '2026-08-31' } }, response);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.close());
