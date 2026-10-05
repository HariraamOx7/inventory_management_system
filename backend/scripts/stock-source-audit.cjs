const fs = require('node:fs');
const path = require('node:path');
const db = require('../config/db');
const root = path.resolve(__dirname, '../../../..');

function readCsv(filename) {
  const bytes = fs.readFileSync(filename);
  const input = bytes.toString(bytes[0] === 255 && bytes[1] === 254 ? 'utf16le' : 'utf8').replace(/^\uFEFF/, '');
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let index = 0; index < input.length; index++) {
    const ch = input[index];
    if (ch === '"') {
      if (quoted && input[index + 1] === '"') { cell += '"'; index++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (ch === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const num = value => Number(String(value || '').replace(/,/g, '').trim()) || 0;
const sum = (rows, column) => rows.reduce((total, row) => total + num(row[column]), 0);
function originalItems() {
  const rows = readCsv('C:/Users/HARIRAAM/Desktop/report2.csv');
  let department = ''; const items = [];
  for (const row of rows) {
    if (String(row[4] || '').trim()) department = row[4].trim();
    if (!/^\d+\/\d+\//.test(row[0] || '')) continue;
    const names = ['openingQty', 'openingValue', 'receivedQty', 'receivedValue', 'issueQty', 'issueValue', 'closingQty', 'closingValue'];
    const columns = [11, 14, 17, 21, 25, 28, 30, 34];
    const item = { itemCode: row[0].trim(), itemName: row[6].trim(), department };
    names.forEach((name, index) => { item[name] = num(row[columns[index]]); });
    items.push(item);
  }
  return items;
}

async function main() {
  const original = originalItems();
  console.log('original', JSON.stringify({ items: original.length,
    totals: Object.fromEntries(['openingQty','openingValue','receivedQty','receivedValue','issueQty','issueValue','closingQty','closingValue'].map(key => [key, original.reduce((t, r) => t + r[key], 0)])) }));
  const legacyReceipts = readCsv(path.join(root, 'DATA/Receipt/receiptdetail.csv')).filter(row => row[29]?.startsWith('2026-08-'));
  const receiptByItem = new Map();
  for (const row of legacyReceipts) {
    const code = row[3]; const item = receiptByItem.get(code) || { qty:0, gross:0, afterDiscount:0, actValue:0 };
    item.qty += num(row[4]); item.gross += num(row[24]);
    item.afterDiscount += num(row[24]) - num(row[8]); item.actValue += num(row[4]) * num(row[25]);
    receiptByItem.set(code, item);
  }
  console.log('legacyReceipts', JSON.stringify({ rows: legacyReceipts.length, qty: sum(legacyReceipts,4), gross:sum(legacyReceipts,24), discount:sum(legacyReceipts,8), net:sum(legacyReceipts,24)-sum(legacyReceipts,8), actValue: legacyReceipts.reduce((t,r)=>t+num(r[4])*num(r[25]),0) }));
  const issues = readCsv(path.join(root, 'DATA/ItemIssue/Item_Issue_detail_old_db_desc.csv')).filter(row => row[6]?.startsWith('2026-08-'));
  console.log('legacyIssues', JSON.stringify({ rows:issues.length, qty:sum(issues,4), value:sum(issues,5) }));
  const discrepancies = original.map(item => ({ ...item, legacyReceipt: receiptByItem.get(item.itemCode) })).filter(item => item.legacyReceipt && Math.abs(item.receivedValue-item.legacyReceipt.afterDiscount)>0.011);
  console.log('receiptDifferences', JSON.stringify(discrepancies.map(item=>({ itemCode:item.itemCode,itemName:item.itemName,original:item.receivedValue,legacy:item.legacyReceipt, delta:item.legacyReceipt.afterDiscount-item.receivedValue })).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,25)));
  const [liveItems] = await db.query('SELECT ItemCode, ItemName, DepartmentId FROM items');
  const known = new Set(liveItems.map(i=>i.ItemCode));
  console.log('sourceCoverage', JSON.stringify({ originalItemsMissing:original.filter(i=>!known.has(i.itemCode)).map(i=>i.itemCode), legacyIssueItemsMissing:[...new Set(issues.filter(r=>!known.has(r[2])).map(r=>r[2]))] }));
  const key = (grn, order, code, qty, rate, gross) => JSON.stringify([String(grn),String(order),code,num(qty),Math.round(num(rate)*1e6)/1e6,Math.round(num(gross)*100)/100]);
  const sourceReceiptKeys = new Set(legacyReceipts.map(r=>key(r[1],r[2],r[3],r[4],r[5],r[24])));
  const [liveReceipts] = await db.query(`SELECT rd.* FROM receipt_details rd JOIN receipts r ON r.GRNNo=rd.GRNNo WHERE r.InwardDate >= '2026-08-01' AND r.InwardDate < '2026-09-01'`);
  const uniqueLive = new Set(liveReceipts.map(r=>key(r.GRNNo,r.OrderNo,r.ItemCode,r.Qty,r.UnitRate,r.TotalAmount)));
  console.log('receiptMatch', JSON.stringify({ uniqueSource:sourceReceiptKeys.size,uniqueLive:uniqueLive.size,unmatchedLive:liveReceipts.filter(r=>!sourceReceiptKeys.has(key(r.GRNNo,r.OrderNo,r.ItemCode,r.Qty,r.UnitRate,r.TotalAmount))).map(r=>({id:r.DetailId,code:r.ItemCode,grn:r.GRNNo})),unmatchedSource:[...sourceReceiptKeys].filter(k=>!uniqueLive.has(k)) }));
  const nameByCode = new Map(liveItems.map(i=>[i.ItemCode,i.ItemName]));
  const canonicalName = name => String(name||'').trim().replace(/"+/g,'').replace(/\s+/g,' ').toUpperCase();
  const issueKeys = new Set(issues.map(r=>JSON.stringify([num(r[1]),canonicalName(nameByCode.get(r[2])),num(r[4])])));
  const [liveIssues] = await db.query(`SELECT d.* FROM item_issue_details d JOIN item_issues h ON h.IssueNo=d.IssueNo WHERE h.IssueDate >= '2026-08-01' AND h.IssueDate < '2026-09-01'`);
  console.log('issueMatch', JSON.stringify({live:liveIssues.length, matched:liveIssues.filter(r=>issueKeys.has(JSON.stringify([num(r.IssueNo),canonicalName(r.ItemName),num(r.Qty)]))).length, unmatched:liveIssues.filter(r=>!issueKeys.has(JSON.stringify([num(r.IssueNo),canonicalName(r.ItemName),num(r.Qty)]))).map(r=>({id:r.DetailId,no:r.IssueNo,name:r.ItemName,qty:r.Qty}))}));
  const issueByItem = new Map();
  for (const row of issues) { const v=issueByItem.get(row[2])||{qty:0,value:0};v.qty+=num(row[4]);v.value+=num(row[5]);issueByItem.set(row[2],v); }
  console.log('rollforwardDifferences',JSON.stringify(original.filter(item=>{
    const receipt=receiptByItem.get(item.itemCode)||{qty:0,actValue:0}; const issue=issueByItem.get(item.itemCode)||{qty:0,value:0};
    return Math.abs(receipt.qty-item.receivedQty)>0.005 || Math.abs(receipt.actValue-item.receivedValue)>0.005 || Math.abs(issue.qty-item.issueQty)>0.005 || Math.abs(issue.value-item.issueValue)>0.005 || Math.abs(item.openingQty+item.receivedQty-item.issueQty-item.closingQty)>0.005 || Math.abs(item.openingValue+item.receivedValue-item.issueValue-item.closingValue)>0.015;
  }).map(i=>({original:i,receipt:receiptByItem.get(i.itemCode),issue:issueByItem.get(i.itemCode)}))));
}
if (require.main === module) main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>db.close());
module.exports = { readCsv, originalItems, num, root };
