//backend/services/historicalStock.js
const db = require('../config/db');
const crypto = require('node:crypto');

const fields = ['openingQty', 'openingValue', 'receivedQty', 'receivedValue', 'issueQty', 'issueValue', 'closingQty', 'closingValue'];
const round = value => Number(Number(value || 0).toFixed(2));

async function getHistoricalDepartmentStock({ from, to, departments, transaction, legacyReport = false }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    throw new Error('A valid report start and end date are required.');
  }
  const options = { replacements: { from, to }, type: db.QueryTypes.SELECT, transaction };
  let batches;
  try {
    batches = await db.query(`SELECT * FROM stock_history_batches b
      WHERE SnapshotDate <= :from AND (VerifiedThrough >= :to OR SourceName = 'KR_2026-2027 staged source totals') AND Status = 'Verified'
      AND (SnapshotDate = :from OR NOT EXISTS (
        SELECT 1 FROM stock_opening_snapshots s
        WHERE s.SnapshotDate = b.SnapshotDate AND s.ClosingValueAdjustment <> 0
      ))
      ORDER BY SnapshotDate DESC LIMIT 1`, options);
  } catch (error) {
    if (error.original?.code !== 'ER_NO_SUCH_TABLE') throw error;
    batches = [];
  }
  if (batches.length !== 1) {
    const error = new Error('Verified historical opening balances and movements are unavailable for this period.');
    error.status = 422;
    throw error;
  }
  // Derive the requested opening from the latest verified earlier snapshot.
  // DATE values can be returned as either strings or Date objects by drivers.
  const baseline = batches[0].SnapshotDate instanceof Date
    ? batches[0].SnapshotDate.toISOString().slice(0, 10)
    : String(batches[0].SnapshotDate).slice(0, 10);
  options.replacements.baseline = baseline;
  const migrated = batches[0].SourceName === 'KR_2026-2027 staged source totals';
  const legacyThrough = migrated
    ? (batches[0].VerifiedThrough instanceof Date ? batches[0].VerifiedThrough.toISOString().slice(0, 10) : String(batches[0].VerifiedThrough).slice(0, 10))
    : '9999-12-31';
  options.replacements.legacyThrough = legacyThrough;
  if (migrated && await calculateMigratedLedgerHash({ from: baseline, to: legacyThrough, transaction }) !== batches[0].SourceHash) {
    const error = new Error('Historical stock records differ from the verified migration baseline. Reconcile them before generating the report.');
    error.status = 422; throw error;
  }
  const missing = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM receipt_details rd JOIN receipts r ON r.GRNNo = rd.GRNNo
        WHERE r.InwardDate >= :baseline AND r.InwardDate <= :legacyThrough AND r.InwardDate < DATE_ADD(:to, INTERVAL 1 DAY) AND rd.StockValue IS NULL)
      ${migrated ? `+ (SELECT COUNT(*) FROM gate_inward_details d JOIN gate_inwards h ON h.InwardNo=d.InwardNo
        WHERE h.InwardDate >= :baseline AND h.InwardDate > :legacyThrough AND h.InwardDate < DATE_ADD(:to, INTERVAL 1 DAY) AND (d.StockUnitRate IS NULL OR d.StockValue IS NULL))` : ''} AS unvaluedReceipts,
      (SELECT COUNT(*) FROM item_issue_details d JOIN item_issues h ON h.IssueNo = d.IssueNo
        WHERE h.IssueDate >= :baseline AND h.IssueDate < DATE_ADD(:to, INTERVAL 1 DAY)
        AND (d.ItemCode IS NULL OR d.TotalAmount IS NULL)) AS unvaluedIssues
  `, options);
  if (Number(missing[0].unvaluedReceipts) || Number(missing[0].unvaluedIssues)) {
    const error = new Error('Some transactions in this period do not have historical stock values. Complete their valuation before generating this report.');
    error.status = 422;
    throw error;
  }
  const rows = await db.query(`
    WITH all_received AS (
      SELECT rd.ItemCode,rd.Qty,rd.StockValue,r.InwardDate AS movementDate
      FROM receipt_details rd JOIN receipts r ON r.GRNNo=rd.GRNNo WHERE r.InwardDate <= :legacyThrough
      ${migrated ? `UNION ALL SELECT d.ItemCode,d.ReceivedQty AS Qty,d.StockValue,h.InwardDate AS movementDate
      FROM gate_inward_details d JOIN gate_inwards h ON h.InwardNo=d.InwardNo WHERE h.InwardDate > :legacyThrough` : ''}
    ), prior_received AS (
      SELECT ItemCode, SUM(Qty) AS qty, ROUND(SUM(StockValue), 2) AS amount
      FROM all_received WHERE movementDate >= :baseline AND movementDate < :from GROUP BY ItemCode
    ), prior_issued AS (
      SELECT d.ItemCode, SUM(d.Qty) AS qty, ROUND(SUM(d.TotalAmount), 2) AS amount
      FROM item_issue_details d JOIN item_issues h ON h.IssueNo = d.IssueNo
      WHERE h.IssueDate >= :baseline AND h.IssueDate < :from GROUP BY d.ItemCode
    ), received AS (
      SELECT ItemCode, SUM(Qty) AS qty, ROUND(SUM(StockValue), 2) AS amount
      FROM all_received WHERE movementDate >= :from AND movementDate < DATE_ADD(:to, INTERVAL 1 DAY)
      GROUP BY ItemCode
    ), issued AS (
      SELECT d.ItemCode, SUM(d.Qty) AS qty, ROUND(SUM(d.TotalAmount), 2) AS amount
      FROM item_issue_details d JOIN item_issues h ON h.IssueNo = d.IssueNo
      WHERE h.IssueDate >= :from AND h.IssueDate < DATE_ADD(:to, INTERVAL 1 DAY)
      GROUP BY d.ItemCode
    ), codes AS (
      SELECT ItemCode FROM stock_opening_snapshots WHERE SnapshotDate = :baseline
      UNION SELECT ItemCode FROM prior_received
      UNION SELECT ItemCode FROM prior_issued
      UNION SELECT ItemCode FROM received
      UNION SELECT ItemCode FROM issued
    )
    SELECT c.ItemCode, i.ItemName, i.UnitRate, i.UOM, i.Location, i.SubHeadCode,
      COALESCE(s.DepartmentName, dept.dept_name, 'Unassigned') AS departmentName,
      dept.dept_id AS departmentId,
      COALESCE(s.OpeningQty, 0) + COALESCE(pr.qty, 0) - COALESCE(pi.qty, 0) AS openingQty,
      COALESCE(s.OpeningValue, 0) + COALESCE(pr.amount, 0) - COALESCE(pi.amount, 0) AS openingValue,
      CASE WHEN :baseline = :from THEN COALESCE(s.ClosingValueAdjustment, 0) ELSE 0 END AS closingValueAdjustment,
      COALESCE(r.qty, 0) AS receivedQty, COALESCE(r.amount, 0) AS receivedValue,
      COALESCE(x.qty, 0) AS issueQty, COALESCE(x.amount, 0) AS issueValue
    FROM codes c
    LEFT JOIN stock_opening_snapshots s ON s.ItemCode = c.ItemCode AND s.SnapshotDate = :baseline
    LEFT JOIN prior_received pr ON pr.ItemCode = c.ItemCode
    LEFT JOIN prior_issued pi ON pi.ItemCode = c.ItemCode
    LEFT JOIN received r ON r.ItemCode = c.ItemCode
    LEFT JOIN issued x ON x.ItemCode = c.ItemCode
    LEFT JOIN items i ON i.ItemCode = c.ItemCode
    LEFT JOIN departments dept ON dept.dept_id = i.DepartmentId
    ORDER BY departmentName, c.ItemCode
  `, options);

  const grouped = new Map();
  const itemBalances = [];
  for (const row of rows) {
    if (departments && !departments.some(value => String(value) === String(row.departmentId) || value.toLowerCase() === row.departmentName.toLowerCase())) continue;
    const openingQty = Number(row.openingQty);
    const receivedQty = Number(row.receivedQty);
    const issueQty = Number(row.issueQty);
    const closingQty = round(openingQty + receivedQty - issueQty);
    if (legacyReport && [openingQty, receivedQty, issueQty, closingQty].every(qty => round(qty) === 0)) continue;
    const originalAdjustment = Number(row.closingValueAdjustment || 0);
    const rawClosingValue = round(Number(row.openingValue) + Number(row.receivedValue) - Number(row.issueValue) + originalAdjustment);
    const legacyAdjustment = legacyReport && closingQty === 0 && rawClosingValue < 0 ? -rawClosingValue : 0;
    const displayAdjustment = originalAdjustment + legacyAdjustment;
    itemBalances.push({
      itemCode: row.ItemCode, itemName: row.ItemName, departmentName: row.departmentName,
      departmentId: row.departmentId, unitRate: Number(row.UnitRate || 0), uom: row.UOM || '',
      location: row.Location || '', subHeadCode: row.SubHeadCode,
      quantity: closingQty,
      value: round(rawClosingValue + legacyAdjustment)
    });
    let item = grouped.get(row.departmentName);
    if (!item) {
      item = { departmentName: row.departmentName, itemCount: 0, reconciliationAdjustment: 0,
        ...Object.fromEntries(fields.map(field => [field, 0])) };
      grouped.set(row.departmentName, item);
    }
    item.itemCount++;
    for (const field of fields.slice(0, 6)) item[field] += Number(row[field]);
    item.reconciliationAdjustment += displayAdjustment;
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
    valuationBasis: legacyReport ? 'Legacy report: excludes quantity-zero rows and clears negative closing value at zero quantity' : 'Historical receipt stock cost and recorded issue value',
    source: batches[0].SourceName, fromDate: from, toDate: to,
    items, itemBalances, totals, reconciliationAdjustment: round(items.reduce((sum, item) => sum + item.reconciliationAdjustment, 0)),
    reportTotalQty: totals.closingQty, reportTotalValue: totals.closingValue
  };
}

// Hash the actual staged ledger, not just aggregate totals: deletions or edits
// that happen without updating timestamps must invalidate the current report.
async function calculateMigratedLedgerHash({ from, to, transaction } = {}) {
  if (!to) {
    const [batch] = await db.query('SELECT VerifiedThrough FROM stock_history_batches WHERE SnapshotDate = :from', { type: db.QueryTypes.SELECT, transaction, replacements: { from } });
    if (!batch) throw new Error('Missing migration batch');
    to = batch.VerifiedThrough instanceof Date ? batch.VerifiedThrough.toISOString().slice(0, 10) : String(batch.VerifiedThrough).slice(0, 10);
  }
  const queries = [
    'SELECT ItemCode, DepartmentName, OpeningQty, OpeningValue, ClosingValueAdjustment FROM stock_opening_snapshots WHERE SnapshotDate = :from ORDER BY ItemCode',
    'SELECT InwardNo, OrderNo, PartyCode, InwardDate FROM gate_inwards WHERE InwardDate <= :to ORDER BY InwardNo',
    'SELECT d.DetailId, d.InwardNo, d.OrderNo, d.ItemCode, d.PendingQty, d.ReceivedQty, d.StockUnitRate, d.StockValue FROM gate_inward_details d JOIN gate_inwards h ON h.InwardNo=d.InwardNo WHERE h.InwardDate <= :to ORDER BY d.DetailId',
    'SELECT GRNNo, GateInwardNo, InwardDate FROM receipts WHERE InwardDate <= :to ORDER BY GRNNo',
    'SELECT d.DetailId, d.GRNNo, d.OrderNo, d.ItemCode, d.Qty, d.StockValue FROM receipt_details d JOIN receipts h ON h.GRNNo=d.GRNNo WHERE h.InwardDate <= :to ORDER BY d.DetailId',
    'SELECT IssueNo, IssueDate FROM item_issues WHERE IssueDate <= :to ORDER BY IssueNo',
    'SELECT d.DetailId, d.IssueNo, d.ItemCode, d.Qty, d.TotalAmount FROM item_issue_details d JOIN item_issues h ON h.IssueNo=d.IssueNo WHERE h.IssueDate <= :to ORDER BY d.DetailId'
  ];
  const hash = crypto.createHash('sha256');
  for (const sql of queries) {
    const rows = await db.query(sql, { type: db.QueryTypes.SELECT, transaction, replacements: { from, to } });
    hash.update(JSON.stringify(rows));
    hash.update('\n');
  }
  return hash.digest('hex');
}

// The migrated legacy ledger and the application's current item rate are
// different valuation bases. Do not equate quantity * item rate to ledger
// value, and do not present a verified snapshot as current after edits.
async function getMigratedCurrentStock({ departments, transaction } = {}) {
  if (!transaction) return db.transaction({ isolationLevel: 'REPEATABLE READ' }, t => getMigratedCurrentStock({ departments, transaction: t }));
  const opts = { type: db.QueryTypes.SELECT, transaction };
  let batches;
  try {
    batches = await db.query(`SELECT * FROM stock_history_batches
      WHERE Status = 'Verified' AND SourceName = 'KR_2026-2027 staged source totals'
      ORDER BY VerifiedThrough DESC LIMIT 1`, opts);
  } catch (error) {
    if (error.original?.code === 'ER_NO_SUCH_TABLE') return null;
    throw error;
  }
  if (!batches.length) return null;
  const batch = batches[0];
  const formatDate = v => v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
  const from = formatDate(batch.SnapshotDate);
  const to = formatDate(batch.VerifiedThrough);
  const actualHash = await calculateMigratedLedgerHash({ from, to, transaction });
  if (actualHash !== batch.SourceHash) {
    const error = new Error('Stock records differ from the verified migration snapshot. Reconcile the ledger before using the current stock report.');
    error.status = 422;
    throw error;
  }
  const [missing] = await db.query(`SELECT
    (SELECT COUNT(*) FROM gate_inward_details d JOIN gate_inwards h ON h.InwardNo=d.InwardNo WHERE h.InwardDate > :to AND (d.StockUnitRate IS NULL OR d.StockValue IS NULL)) AS inward,
    (SELECT COUNT(*) FROM item_issue_details d JOIN item_issues h ON h.IssueNo=d.IssueNo WHERE h.IssueDate > :to AND (d.ItemCode IS NULL OR d.TotalAmount IS NULL)) AS issues`, { ...opts, replacements: { to } });
  if (Number(missing.inward) || Number(missing.issues)) {
    const error = new Error('Some new stock movements have no recorded valuation. Reconcile them before using the current stock report.');
    error.status = 422; throw error;
  }
  const historical = await getHistoricalDepartmentStock({ from, to, transaction });
  const balances = new Map(historical.itemBalances.map(item => [item.itemCode, { ...item }]));
  const newItems = await db.query(`SELECT i.ItemCode,i.ItemName,i.Quantity,i.UnitRate,i.UOM,i.Location,i.SubHeadCode,d.dept_id AS departmentId,COALESCE(d.dept_name,'Unassigned') AS departmentName FROM items i LEFT JOIN departments d ON d.dept_id=i.DepartmentId`, opts);
  const inward = await db.query(`SELECT d.ItemCode,SUM(d.ReceivedQty) qty,SUM(d.StockValue) value,MAX(h.InwardDate) lastDate FROM gate_inward_details d JOIN gate_inwards h ON h.InwardNo=d.InwardNo WHERE h.InwardDate > :to GROUP BY d.ItemCode`, { ...opts, replacements: { to } });
  const issues = await db.query(`SELECT d.ItemCode,SUM(d.Qty) qty,SUM(d.TotalAmount) value,MAX(h.IssueDate) lastDate FROM item_issue_details d JOIN item_issues h ON h.IssueNo=d.IssueNo WHERE h.IssueDate > :to GROUP BY d.ItemCode`, { ...opts, replacements: { to } });
  const newByCode = new Map(newItems.map(i => [i.ItemCode, i]));
  const newByCodeLower = new Map(newItems.map(i => [String(i.ItemCode).trim().toLowerCase(), i]));
  let asOf = to;
  for (const i of newItems) if (!balances.has(i.ItemCode)) balances.set(i.ItemCode, { itemCode: i.ItemCode, quantity: 0, value: 0 });
  for (const [rows, sign] of [[inward, 1], [issues, -1]]) for (const movement of rows) {
    const item = balances.get(movement.ItemCode);
    if (!item) { const error = new Error(`Stock movement references missing item ${movement.ItemCode}`); error.status = 422; throw error; }
    item.quantity += sign * Number(movement.qty); item.value += sign * Number(movement.value);
    const movementDate = formatDate(movement.lastDate); if (movementDate > asOf) asOf = movementDate;
  }
  const grouped = new Map(), itemBalances = [];
  for (const item of balances.values()) {
    const master = newByCode.get(item.itemCode) || newByCodeLower.get(String(item.itemCode).trim().toLowerCase());
    const deptId = master?.departmentId || item.departmentId;
    const deptName = master?.departmentName || item.departmentName || 'Unassigned';
    if (departments && !departments.some(v => String(v) === String(deptId) || String(v).toLowerCase() === deptName.toLowerCase())) continue;
    if (!master) {
      console.warn(`[Stock Ledger] Item ${item.itemCode} in stock history is not in items table.`);
      continue;
    }
    const diff = Math.abs(Number(master.Quantity || 0) - item.quantity);
    if (diff > 0.001) {
      console.warn(`[Stock Ledger] Quantity difference for ${item.itemCode}: master=${master.Quantity}, ledger=${item.quantity}`);
    }
    Object.assign(item, { itemName: master.ItemName, unitRate: Number(master.UnitRate || 0), uom: master.UOM || '', location: master.Location || '', subHeadCode: master.SubHeadCode, departmentId: deptId, departmentName: deptName, quantity: round(item.quantity), value: round(item.value) });
    itemBalances.push(item);
    if (!grouped.has(item.departmentName)) grouped.set(item.departmentName, { departmentName: item.departmentName, itemCount: 0, closingQty: 0, closingValue: 0 });
    const group = grouped.get(item.departmentName); group.itemCount++; group.closingQty += item.quantity; group.closingValue += item.value;
  }
  const items = [...grouped.values()].sort((a,b) => a.departmentName.localeCompare(b.departmentName)).map((g,i) => ({ ...g, slNo:i+1, closingQty:round(g.closingQty), closingValue:round(g.closingValue), totalQty:round(g.closingQty), totalValue:round(g.closingValue) }));
  return { ...historical, itemBalances, items, toDate:asOf, valuationBasis:'Verified legacy stock plus recorded inward cost and issue value', reportTotalQty:round(items.reduce((s,i)=>s+i.closingQty,0)), reportTotalValue:round(items.reduce((s,i)=>s+i.closingValue,0)) };
}

module.exports = { getHistoricalDepartmentStock, getMigratedCurrentStock, calculateMigratedLedgerHash, fields };
