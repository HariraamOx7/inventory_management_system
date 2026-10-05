const db = require('../config/db');

const fields = ['openingQty', 'openingValue', 'receivedQty', 'receivedValue', 'issueQty', 'issueValue', 'closingQty', 'closingValue'];
const round = value => Number(Number(value || 0).toFixed(2));

async function getHistoricalDepartmentStock({ from, to, departments, transaction }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    throw new Error('A valid report start and end date are required.');
  }
  const options = { replacements: { from, to }, type: db.QueryTypes.SELECT, transaction };
  let batches;
  try {
    batches = await db.query(`SELECT * FROM stock_history_batches
      WHERE SnapshotDate = :from AND VerifiedThrough >= :to AND Status = 'Verified'`, options);
  } catch (error) {
    if (error.original?.code !== 'ER_NO_SUCH_TABLE') throw error;
    batches = [];
  }
  if (batches.length !== 1) {
    const error = new Error('Verified historical opening balances and movements are unavailable for this period.');
    error.status = 422;
    throw error;
  }
  const missing = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM receipt_details rd JOIN receipts r ON r.GRNNo = rd.GRNNo
        WHERE r.InwardDate >= :from AND r.InwardDate < DATE_ADD(:to, INTERVAL 1 DAY) AND rd.StockValue IS NULL) AS unvaluedReceipts,
      (SELECT COUNT(*) FROM item_issue_details d JOIN item_issues h ON h.IssueNo = d.IssueNo
        WHERE h.IssueDate >= :from AND h.IssueDate < DATE_ADD(:to, INTERVAL 1 DAY)
        AND (d.ItemCode IS NULL OR d.TotalAmount IS NULL)) AS unvaluedIssues
  `, options);
  if (Number(missing[0].unvaluedReceipts) || Number(missing[0].unvaluedIssues)) {
    const error = new Error('Some transactions in this period do not have historical stock values. Complete their valuation before generating this report.');
    error.status = 422;
    throw error;
  }
  const rows = await db.query(`
    WITH received AS (
      SELECT rd.ItemCode, SUM(rd.Qty) AS qty, ROUND(SUM(rd.StockValue), 2) AS amount
      FROM receipt_details rd JOIN receipts r ON r.GRNNo = rd.GRNNo
      WHERE r.InwardDate >= :from AND r.InwardDate < DATE_ADD(:to, INTERVAL 1 DAY)
      GROUP BY rd.ItemCode
    ), issued AS (
      SELECT d.ItemCode, SUM(d.Qty) AS qty, ROUND(SUM(d.TotalAmount), 2) AS amount
      FROM item_issue_details d JOIN item_issues h ON h.IssueNo = d.IssueNo
      WHERE h.IssueDate >= :from AND h.IssueDate < DATE_ADD(:to, INTERVAL 1 DAY)
      GROUP BY d.ItemCode
    ), codes AS (
      SELECT ItemCode FROM stock_opening_snapshots WHERE SnapshotDate = :from
      UNION SELECT ItemCode FROM received
      UNION SELECT ItemCode FROM issued
    )
    SELECT c.ItemCode, COALESCE(s.DepartmentName, dept.dept_name, 'Unassigned') AS departmentName,
      dept.dept_id AS departmentId,
      COALESCE(s.OpeningQty, 0) AS openingQty, COALESCE(s.OpeningValue, 0) AS openingValue,
      COALESCE(s.ClosingValueAdjustment, 0) AS closingValueAdjustment,
      COALESCE(r.qty, 0) AS receivedQty, COALESCE(r.amount, 0) AS receivedValue,
      COALESCE(x.qty, 0) AS issueQty, COALESCE(x.amount, 0) AS issueValue
    FROM codes c
    LEFT JOIN stock_opening_snapshots s ON s.ItemCode = c.ItemCode AND s.SnapshotDate = :from
    LEFT JOIN received r ON r.ItemCode = c.ItemCode
    LEFT JOIN issued x ON x.ItemCode = c.ItemCode
    LEFT JOIN items i ON i.ItemCode = c.ItemCode
    LEFT JOIN departments dept ON dept.dept_id = i.DepartmentId
    ORDER BY departmentName, c.ItemCode
  `, options);

  const grouped = new Map();
  for (const row of rows) {
    if (departments && !departments.some(value => String(value) === String(row.departmentId) || value.toLowerCase() === row.departmentName.toLowerCase())) continue;
    let item = grouped.get(row.departmentName);
    if (!item) {
      item = { departmentName: row.departmentName, itemCount: 0, reconciliationAdjustment: 0,
        ...Object.fromEntries(fields.map(field => [field, 0])) };
      grouped.set(row.departmentName, item);
    }
    item.itemCount++;
    for (const field of fields.slice(0, 6)) item[field] += Number(row[field]);
    item.reconciliationAdjustment += Number(row.closingValueAdjustment || 0);
  }
  const items = [...grouped.values()].map((item, index) => {
    item.closingQty = item.openingQty + item.receivedQty - item.issueQty;
    item.closingValue = item.openingValue + item.receivedValue - item.issueValue + item.reconciliationAdjustment;
    item.reconciliationAdjustment = round(item.reconciliationAdjustment);
    for (const field of fields) item[field] = round(item[field]);
    return { slNo: index + 1, ...item, totalQty: item.closingQty, totalValue: item.closingValue };
  });
  const totals = Object.fromEntries(fields.map(field => [field, round(items.reduce((sum, item) => sum + item[field], 0))]));
  return {
    reportTitle: 'Department wise stock abstract', historical: true,
    valuationBasis: 'Historical receipt stock cost and recorded issue value',
    source: batches[0].SourceName, fromDate: from, toDate: to,
    items, totals, reconciliationAdjustment: round(items.reduce((sum, item) => sum + item.reconciliationAdjustment, 0)),
    reportTotalQty: totals.closingQty, reportTotalValue: totals.closingValue
  };
}

module.exports = { getHistoricalDepartmentStock, fields };
