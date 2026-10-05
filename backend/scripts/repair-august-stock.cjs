// Scoped, recoverable legacy repair. A successful SQL dump is mandatory.
// Usage: node scripts/repair-august-stock.cjs --backup <dump.sql>
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const db = require('../config/db');
const { readCsv, originalItems, num, root } = require('./stock-source-audit.cjs');
const { getHistoricalDepartmentStock, fields } = require('../services/historicalStock');
const from = '2026-08-01';
const to = '2026-08-31';
const canonicalName = name => String(name || '').trim().replace(/"+/g, '').replace(/\s+/g, ' ').toUpperCase();
const receiptKey = row => JSON.stringify([String(row.GRNNo), String(row.OrderNo), row.ItemCode, num(row.Qty), Math.round(num(row.UnitRate) * 1e6) / 1e6, Math.round(num(row.TotalAmount) * 100) / 100]);
const issueKey = row => JSON.stringify([num(row.IssueNo), canonicalName(row.ItemName), num(row.Qty)]);
const round = n => Number(n.toFixed(2));

async function ensureColumns(table, definitions) {
  const [columns] = await db.query(`SHOW COLUMNS FROM ${table}`);
  const names = new Set(columns.map(column => column.Field));
  for (const [name, definition] of Object.entries(definitions)) {
    if (!names.has(name)) await db.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
  const [indexes] = await db.query(`SHOW INDEX FROM ${table}`);
  if (!indexes.some(index => index.Column_name === 'SourceKey' && !index.Non_unique)) {
    await db.query(`ALTER TABLE ${table} ADD UNIQUE KEY ${table}_source_key (SourceKey)`);
  }
}

async function ensureTableColumns(table, definitions) {
  const [columns] = await db.query(`SHOW COLUMNS FROM ${table}`);
  const names = new Set(columns.map(column => column.Field));
  for (const [name, definition] of Object.entries(definitions)) {
    if (!names.has(name)) await db.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

async function main() {
  const backupArg = process.argv.indexOf('--backup');
  const backupPath = backupArg >= 0 ? path.resolve(process.argv[backupArg + 1] || '') : '';
  if (!backupPath || !fs.existsSync(backupPath) || fs.statSync(backupPath).size < 1000) throw new Error('A full SQL backup is required.');
  if (!fs.readFileSync(backupPath, 'utf8').includes('-- Dump completed on')) throw new Error('SQL backup is incomplete.');
  const [identity] = await db.query('SELECT DATABASE() AS db, @@port AS port');
  if (identity[0].db !== 'stores' || Number(identity[0].port) !== 3306) throw new Error('Unexpected target database.');

  const original = originalItems();
  if (original.length !== 1075 || new Set(original.map(row => row.itemCode)).size !== 1075) throw new Error('Unexpected original-report item coverage.');
  const sourceReceipts = readCsv(path.join(root, 'DATA/Receipt/receiptdetail.csv'))
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row[29]?.startsWith('2026-08-'))
    .map(({ row, index }) => ({ GRNNo: num(row[1]), OrderNo: num(row[2]), ItemCode: row[3], Qty: num(row[4]), UnitRate: num(row[5]), TotalAmount: num(row[24]), StockUnitRate: num(row[25]), StockValue: num(row[4]) * num(row[25]), SourceKey: `legacy-receipt:${index + 1}` }));
  const sourceIssues = readCsv(path.join(root, 'DATA/ItemIssue/Item_Issue_detail_old_db_desc.csv'))
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row[6]?.startsWith('2026-08-'))
    .map(({ row, index }) => ({ IssueNo: num(row[1]), ItemCode: row[2], Qty: num(row[4]), TotalAmount: num(row[5]), IssueDate: row[6].slice(0, 10), SourceKey: `legacy-issue:${index + 1}` }));
  if (sourceReceipts.length !== 291 || sourceIssues.length !== 608) throw new Error('Unexpected legacy source coverage.');
  const expectedTotals = Object.fromEntries(fields.map(field => [field, round(original.reduce((sum, row) => sum + row[field], 0))]));
  const [items] = await db.query('SELECT ItemCode, ItemName, DepartmentId, UOM FROM items');
  const itemMap = new Map(items.map(item => [item.ItemCode, item]));
  for (const source of sourceIssues) {
    const item = itemMap.get(source.ItemCode);
    if (!item) throw new Error(`Unknown source item ${source.ItemCode}`);
    source.ItemName = item.ItemName;
    source.UOM = item.UOM;
    source.DepartmentId = item.DepartmentId;
    source.UnitRate = source.Qty ? source.TotalAmount / source.Qty : 0;
  }
  if (original.some(row => !itemMap.has(row.itemCode))) throw new Error('Missing original-report item master records.');

  await ensureColumns('receipt_details', { StockUnitRate: 'DECIMAL(20,8) NULL', StockValue: 'DECIMAL(20,6) NULL', SourceKey: 'VARCHAR(100) NULL' });
  await ensureColumns('item_issue_details', { ItemCode: 'VARCHAR(255) NULL', UnitRate: 'DECIMAL(20,8) NULL', TotalAmount: 'DECIMAL(20,6) NULL', SourceKey: 'VARCHAR(100) NULL' });
  await db.query(`CREATE TABLE IF NOT EXISTS stock_history_batches (
    SnapshotDate DATE PRIMARY KEY, VerifiedThrough DATE NOT NULL,
    SourceName VARCHAR(255) NOT NULL, SourceHash CHAR(64) NOT NULL,
    BackupPath TEXT NOT NULL, Status VARCHAR(20) NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  await db.query(`CREATE TABLE IF NOT EXISTS stock_opening_snapshots (
    SnapshotDate DATE NOT NULL, ItemCode VARCHAR(255) NOT NULL,
    DepartmentName VARCHAR(255) NOT NULL, OpeningQty DECIMAL(20,2) NOT NULL,
    OpeningValue DECIMAL(20,2) NOT NULL,
    ClosingValueAdjustment DECIMAL(20,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (SnapshotDate, ItemCode)
  ) ENGINE=InnoDB`);
  await ensureTableColumns('stock_opening_snapshots', { ClosingValueAdjustment: 'DECIMAL(20,2) NOT NULL DEFAULT 0' });
  await db.query('CREATE TABLE IF NOT EXISTS receipt_details_aug2026_quarantine LIKE receipt_details');
  await db.query('CREATE TABLE IF NOT EXISTS item_issue_details_aug2026_quarantine LIKE item_issue_details');
  const existing = await db.query('SELECT * FROM stock_history_batches WHERE SnapshotDate = :from', { replacements: { from }, type: db.QueryTypes.SELECT });
  if (existing.length) {
    const report = await getHistoricalDepartmentStock({ from, to });
    for (const field of fields) if (report.totals[field] !== expectedTotals[field]) throw new Error(`Existing repair does not reconcile: ${field}`);
    console.log(JSON.stringify({ status: 'Already repaired; no data changed', totals: report.totals, reconciliationAdjustment: report.reconciliationAdjustment }));
    return;
  }

  const transaction = await db.transaction();
  const query = (sql, replacements = {}) => db.query(sql, { transaction, replacements, type: db.QueryTypes.SELECT });
  try {
    const liveReceipts = await query(`SELECT rd.* FROM receipt_details rd JOIN receipts r ON r.GRNNo = rd.GRNNo
      WHERE r.InwardDate >= :from AND r.InwardDate < '2026-09-01' ORDER BY rd.DetailId FOR UPDATE`, { from });
    const liveIssues = await query(`SELECT d.* FROM item_issue_details d JOIN item_issues h ON h.IssueNo = d.IssueNo
      WHERE h.IssueDate >= :from AND h.IssueDate < '2026-09-01' FOR UPDATE`, { from });
    const receiptSourceMap = new Map(sourceReceipts.map(row => [receiptKey(row), row]));
    if (receiptSourceMap.size !== 291 || liveReceipts.some(row => !receiptSourceMap.has(receiptKey(row)))) throw new Error('Receipt source identity mismatch.');
    const groups = new Map();
    for (const row of liveReceipts) {
      const key = receiptKey(row);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    if (groups.size !== 291) throw new Error('Some original receipt lines are missing.');
    const issueSourceKeys = new Set(sourceIssues.map(issueKey));
    if (liveIssues.some(row => !issueSourceKeys.has(issueKey(row)))) throw new Error('Unexpected August issue transaction; preserve it and investigate before replacing.');

    const duplicateIds = [...groups.values()].flatMap(rows => rows.slice(1).map(row => row.DetailId));
    if (duplicateIds.length !== 534) throw new Error('August duplicate count changed since audit.');
    await db.query('INSERT INTO receipt_details_aug2026_quarantine SELECT * FROM receipt_details WHERE DetailId IN (:ids)', { transaction, replacements: { ids: duplicateIds } });
    await db.query('DELETE FROM receipt_details WHERE DetailId IN (:ids)', { transaction, replacements: { ids: duplicateIds } });
    for (const [key, rows] of groups) {
      const source = receiptSourceMap.get(key);
      await db.query(`UPDATE receipt_details SET StockUnitRate = :rate, StockValue = :amount, SourceKey = :source WHERE DetailId = :id`, {
        transaction, replacements: { rate: source.StockUnitRate.toFixed(8), amount: source.StockValue.toFixed(6), source: source.SourceKey, id: rows[0].DetailId }
      });
    }
    if (liveIssues.length) {
      const ids = liveIssues.map(row => row.DetailId);
      await db.query('INSERT INTO item_issue_details_aug2026_quarantine SELECT * FROM item_issue_details WHERE DetailId IN (:ids)', { transaction, replacements: { ids } });
      await db.query('DELETE FROM item_issue_details WHERE DetailId IN (:ids)', { transaction, replacements: { ids } });
    }
    const [departments] = await db.query('SELECT dept_id, dept_name FROM departments', { transaction });
    const departmentMap = new Map(departments.map(row => [row.dept_id, row.dept_name]));
    for (const source of sourceIssues) {
      const headers = await query('SELECT IssueNo, IssueDate FROM item_issues WHERE IssueNo = :no', { no: source.IssueNo });
      if (headers.length && String(headers[0].IssueDate).slice(0, 10) !== source.IssueDate) throw new Error(`Issue date mismatch for ${source.IssueNo}`);
      if (!headers.length) {
        await db.query(`INSERT INTO item_issues (IssueNo, IssueDate, Department, Status, createdAt, updatedAt)
          VALUES (:no, :date, :department, 'Draft', NOW(), NOW())`, { transaction, replacements: { no: source.IssueNo, date: source.IssueDate, department: departmentMap.get(source.DepartmentId) || 'Unassigned' } });
      }
      await db.query(`INSERT INTO item_issue_details
        (IssueNo, ItemCode, ItemName, Qty, UnitRate, TotalAmount, SourceKey, UOM, OpeningQty, createdAt, updatedAt)
        VALUES (:no, :code, :name, :qty, :rate, :amount, :source, :uom, 0, NOW(), NOW())`, {
        transaction, replacements: { no: source.IssueNo, code: source.ItemCode, name: source.ItemName, qty: source.Qty, rate: source.UnitRate.toFixed(8), amount: source.TotalAmount.toFixed(6), source: source.SourceKey, uom: source.UOM }
      });
    }
    for (const row of original) {
      const adjustment = round(row.closingValue - (row.openingValue + row.receivedValue - row.issueValue));
      await db.query(`INSERT INTO stock_opening_snapshots
        (SnapshotDate, ItemCode, DepartmentName, OpeningQty, OpeningValue, ClosingValueAdjustment)
        VALUES (:from, :code, :department, :qty, :amount, :adjustment)`, {
        transaction,
        replacements: { from, code: row.itemCode, department: row.department, qty: row.openingQty, amount: row.openingValue, adjustment }
      });
    }
    const sourceHash = crypto.createHash('sha256').update(fs.readFileSync('C:/Users/HARIRAAM/Desktop/report2.csv')).digest('hex');
    await db.query(`INSERT INTO stock_history_batches (SnapshotDate, VerifiedThrough, SourceName, SourceHash, BackupPath, Status)
      VALUES (:from, :to, 'Original August report and legacy receipt/issue exports', :hash, :backup, 'Verified')`, { transaction, replacements: { from, to, hash: sourceHash, backup: backupPath } });
    const report = await getHistoricalDepartmentStock({ from, to, transaction });
    for (const field of fields) if (report.totals[field] !== expectedTotals[field]) throw new Error(`Verification failed: ${field}: ${report.totals[field]} vs ${expectedTotals[field]}`);
    await transaction.commit();
    console.log(JSON.stringify({ status: 'Repair committed', quarantinedReceipts: duplicateIds.length, quarantinedIssues: liveIssues.length, restoredIssues: sourceIssues.length, openingItems: original.length, totals: report.totals, reconciliationAdjustment: report.reconciliationAdjustment, backupPath }));
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.close());
