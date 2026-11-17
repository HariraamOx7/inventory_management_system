// Database-free checks for the production stock-report 422 regression.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

function loadSource(relativePath, requireStub) {
  const filename = path.resolve(__dirname, relativePath);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    require: requireStub, module, exports: module.exports,
    console: { warn() {}, error() {} }
  }, { filename });
  return module.exports;
}

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}

const itemCode = '01/09/BI/3114';

test('October detail uses October balances despite a different current quantity', async () => {
  let requested;
  const controller = loadSource('../controllers/reportController.js', name => {
    if (name === '../config/db') return {
      QueryTypes: { SELECT: 'SELECT' },
      query: async () => [{ ItemCode: itemCode, masterQty: 12 }]
    };
    if (name === '../services/historicalStock') return {
      getHistoricalDepartmentStock: async options => {
        requested = options;
        return { valuationBasis: 'Historical stock cost', itemBalances: [{
          itemCode, itemName: 'Test bearing', departmentName: 'Bearing',
          quantity: 10, value: 250, unitRate: 25, uom: 'Nos'
        }] };
      },
      getMigratedCurrentStock: async () => { throw new Error('Current report must not run for a dated request'); }
    };
    return {};
  });
  const res = response();
  await controller.getDepartmentWiseStockDetail({ query: {
    fromDate: '2026-10-01', toDate: '2026-10-31'
  } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(requested.from, '2026-10-01');
  assert.equal(requested.to, '2026-10-31');
  assert.equal(res.body.data.asOfDate, '2026-10-31');
  assert.equal(res.body.data.reportTotalQty, 10);
  assert.equal(res.body.data.reportTotalValue, 250);
  assert.equal(res.body.data.discrepanciesCount, 1);
  assert.equal(res.body.data.discrepancies[0].difference, 2);
});

test('unverified dated stock still returns 422 instead of falling back to current stock', async () => {
  const controller = loadSource('../controllers/reportController.js', name => {
    if (name === '../config/db') return { QueryTypes: { SELECT: 'SELECT' }, query: async () => [] };
    if (name === '../services/historicalStock') return {
      getHistoricalDepartmentStock: async () => {
        throw Object.assign(new Error('Historical stock records differ from the verified migration baseline.'), { status: 422 });
      },
      getMigratedCurrentStock: async () => { throw new Error('Unsafe fallback'); }
    };
    return {};
  });
  const res = response();
  await controller.getDepartmentWiseStockDetail({ query: {
    fromDate: '2026-10-01', toDate: '2026-10-31'
  } }, res);
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /verified migration baseline/);
});

function stockService({ invalidHash = false, unvalued = false } = {}) {
  const hash = crypto.createHash('sha256');
  for (let i = 0; i < 7; i++) hash.update('[]\n');
  const batch = { SnapshotDate: '2026-04-01', VerifiedThrough: '2026-10-26',
    SourceName: 'KR_2026-2027 staged source totals', SourceHash: invalidHash ? 'invalid' : hash.digest('hex') };
  const db = { QueryTypes: { SELECT: 'SELECT' }, query: async sql => {
    if (sql.includes('SELECT * FROM stock_history_batches')) return [batch];
    if (sql.includes('AS inward,')) return [{ inward: unvalued ? 1 : 0, issues: 0 }];
    if (sql.includes('AS unvaluedReceipts,')) return [{ unvaluedReceipts: 0, unvaluedIssues: 0 }];
    if (sql.includes('WITH all_received')) return [{ ItemCode: itemCode, ItemName: 'Test bearing',
      departmentId: 1, departmentName: 'Bearing', UnitRate: 25,
      openingQty: 10, openingValue: 250, receivedQty: 0, receivedValue: 0, issueQty: 0, issueValue: 0 }];
    if (sql.includes('SELECT i.ItemCode,i.ItemName,i.Quantity')) return [{ ItemCode: itemCode,
      ItemName: 'Test bearing', Quantity: 15, UnitRate: 99, departmentId: 1, departmentName: 'Bearing' }];
    if (sql.includes('WHERE h.InwardDate > :to GROUP BY')) return [{ ItemCode: itemCode, qty: 3, value: 75, lastDate: '2026-10-27' }];
    if (sql.includes('WHERE h.IssueDate > :to GROUP BY')) return [{ ItemCode: itemCode, qty: 1, value: 25, lastDate: '2026-10-28' }];
    if (sql.includes('ORDER BY')) return []; // Seven migration fingerprint queries.
    throw new Error(`Unexpected query: ${sql}`);
  } };
  return loadSource('../services/historicalStock.js', name => {
    if (name === '../config/db') return db;
    if (name === 'node:crypto') return crypto;
    throw new Error(`Unexpected dependency: ${name}`);
  });
}

test('current stock retains ledger cost when master quantity differs', async () => {
  const result = await stockService().getMigratedCurrentStock({ transaction: {} });
  assert.equal(result.itemBalances.length, 1);
  assert.equal(result.reportTotalQty, 12);
  assert.equal(result.reportTotalValue, 300); // Recorded cost, never master rate 99.
  assert.equal(result.toDate, '2026-10-28');
});

test('current stock still blocks altered migration history and unvalued movements', async () => {
  for (const options of [{ invalidHash: true }, { unvalued: true }]) {
    await assert.rejects(stockService(options).getMigratedCurrentStock({ transaction: {} }),
      error => error.status === 422);
  }
});
