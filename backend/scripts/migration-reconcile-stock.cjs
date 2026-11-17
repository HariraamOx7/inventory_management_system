// Read-only comparison of the legacy stock calculation and isolated staging data.
const { execFileSync } = require('node:child_process');
const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true });
const stage=process.env.MIGRATION_STAGE;
if (!/^stores_stage_[a-z0-9_]+$/.test(stage || '')) throw new Error('Set MIGRATION_STAGE to an isolated staging database');
const sql=`SET NOCOUNT ON; SELECT i.ItemCode, i.Opening, i.OpenValue,
 COALESCE(r.qty,0) recQty, COALESCE(r.val,0) recValue,
 COALESCE(s.qty,0) issQty, COALESCE(s.val,0) issValue
 FROM dbo.ItemMas i
 LEFT JOIN (SELECT d.ItemCode,SUM(d.Qty) qty,SUM(d.TotalAmount+d.PfAmount+d.LorryFreight-d.DiscountAmount) val FROM dbo.StoreReceiptDetail d JOIN dbo.StoreReceiptHead h ON h.GrnNo=d.GrnNo WHERE h.GrnDate >= '20260401' AND h.GrnDate < '20261027' GROUP BY d.ItemCode) r ON r.ItemCode=i.ItemCode
 LEFT JOIN (SELECT d.ItemCode,SUM(d.Qty) qty,SUM(d.IssueValue) val FROM dbo.StoreIssDetail d JOIN dbo.StoreIssHead h ON h.IssueNo=d.IssueNo WHERE h.IssueDate >= '20260401' AND h.IssueDate < '20261027' GROUP BY d.ItemCode) s ON s.ItemCode=i.ItemCode FOR JSON PATH, INCLUDE_NULL_VALUES`;
function source() { const o=execFileSync('sqlcmd',['-S','.\\SQLEXPRESS','-E','-d','KR_2026-2027','-y','0','-w','65535','-b','-Q',sql],{encoding:'utf8',maxBuffer:50*1024*1024}); const p=o.indexOf('['); if(p<0) throw new Error('Missing source JSON'); return JSON.parse(o.slice(p).trim().replace(/\r?\n/g,'')); }
async function main(){const original=source(); const c=await mysql.createConnection({host:'127.0.0.1',user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:stage});try {
 const [rows]=await c.query(`SELECT i.ItemCode,COALESCE(o.OpeningQty,i.OpeningQty) opening,COALESCE(o.OpeningValue,i.OpenValue) openValue,COALESCE(r.qty,0) recQty,COALESCE(r.val,0) recValue,COALESCE(s.qty,0) issQty,COALESCE(s.val,0) issValue FROM items i LEFT JOIN stock_opening_snapshots o ON o.ItemCode=i.ItemCode AND o.SnapshotDate='2026-04-01' LEFT JOIN (SELECT d.ItemCode,SUM(d.Qty) qty,SUM(d.StockValue) val FROM receipt_details d JOIN receipts h ON h.GRNNo=d.GRNNo WHERE h.InwardDate >= '2026-04-01' AND h.InwardDate < '2026-10-27' GROUP BY d.ItemCode) r ON r.ItemCode=i.ItemCode LEFT JOIN (SELECT d.ItemCode,SUM(d.Qty) qty,SUM(d.TotalAmount) val FROM item_issue_details d JOIN item_issues h ON h.IssueNo=d.IssueNo WHERE h.IssueDate >= '2026-04-01' AND h.IssueDate < '2026-10-27' GROUP BY d.ItemCode) s ON s.ItemCode=i.ItemCode`);
 const byCode=new Map(rows.map(r=>[r.ItemCode,r])); let missing=0; const mismatches=[]; const fields=[['Opening','opening'],['OpenValue','openValue'],['recQty','recQty'],['recValue','recValue'],['issQty','issQty'],['issValue','issValue']];
 for(const item of original){const target=byCode.get(item.ItemCode);if(!target){missing++;continue;}for(const [a,b] of fields){const delta=Number(target[b])-Number(item[a]);if(Math.abs(delta)>0.00001)mismatches.push({item:item.ItemCode,field:a,source:Number(item[a]),stage:Number(target[b]),difference:Number(delta.toFixed(6))});}}
 console.log(JSON.stringify({period:'2026-04-01 through 2026-10-26',sourceItems:original.length,stagedItems:rows.length,missing,mismatches:mismatches.length,examples:mismatches.slice(0,30)},null,2));
 const known = new Map([['17/25/Ot/10866',0.002],['17/25/Ot/10873',0.005]]);
 if(missing || rows.length !== original.length || mismatches.some(m => m.field !== 'recQty' || !known.has(m.item) || Math.abs(m.difference-known.get(m.item)) > 0.000001)) throw new Error('Unexpected source-to-stage stock discrepancy');
 }finally{await c.end();}}
main().catch(e=>{console.error(e.message);process.exitCode=1});
