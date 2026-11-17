// Prepare the first financial-year snapshot in the isolated staging database.
const mysql=require('mysql2/promise');
const crypto=require('node:crypto');
require('dotenv').config({quiet:true});
const stage=process.env.MIGRATION_STAGE;
if(!/^stores_stage_[a-z0-9_]+$/.test(stage||''))throw new Error('An isolated staging database is required');
async function main(){const c=await mysql.createConnection({host:'127.0.0.1',user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:stage});try{
 const [existing]=await c.query('SELECT COUNT(*) n FROM stock_history_batches');if(existing[0].n)throw new Error('Stock history already exists');
 const [missing]=await c.query('SELECT (SELECT COUNT(*) FROM receipt_details WHERE StockValue IS NULL) receipts,(SELECT COUNT(*) FROM item_issue_details WHERE ItemCode IS NULL OR TotalAmount IS NULL) issues');if(missing[0].receipts||missing[0].issues)throw new Error('Unvalued movements');
 const [fingerprint]=await c.query('SELECT (SELECT COUNT(*) FROM items) items,(SELECT COUNT(*) FROM receipt_details) receipts,(SELECT COUNT(*) FROM item_issue_details) issues,(SELECT SUM(OpeningQty) FROM items) opening_qty,(SELECT SUM(OpenValue) FROM items) opening_value,(SELECT SUM(StockValue) FROM receipt_details) receipt_value,(SELECT SUM(TotalAmount) FROM item_issue_details) issue_value');
 const hash=crypto.createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex');
 await c.beginTransaction();try{
 await c.query(`INSERT INTO stock_opening_snapshots (SnapshotDate,ItemCode,DepartmentName,OpeningQty,OpeningValue,ClosingValueAdjustment) SELECT '2026-04-01',i.ItemCode,COALESCE(d.dept_name,'Unassigned'),i.OpeningQty,i.OpenValue,0 FROM items i LEFT JOIN departments d ON d.dept_id=i.DepartmentId`);
 await c.query(`UPDATE items i LEFT JOIN (SELECT d.ItemCode,SUM(d.Qty) qty FROM receipt_details d JOIN receipts h ON h.GRNNo=d.GRNNo WHERE h.InwardDate >= '2026-04-01' AND h.InwardDate < '2026-10-27' GROUP BY d.ItemCode) r ON r.ItemCode=i.ItemCode LEFT JOIN (SELECT d.ItemCode,SUM(d.Qty) qty FROM item_issue_details d JOIN item_issues h ON h.IssueNo=d.IssueNo WHERE h.IssueDate >= '2026-04-01' AND h.IssueDate < '2026-10-27' GROUP BY d.ItemCode) s ON s.ItemCode=i.ItemCode SET i.Quantity=i.OpeningQty+COALESCE(r.qty,0)-COALESCE(s.qty,0), i.OpeningQty=i.OpeningQty+COALESCE(r.qty,0)-COALESCE(s.qty,0)`);
 await c.query('INSERT INTO stock_history_batches (SnapshotDate,VerifiedThrough,SourceName,SourceHash,BackupPath,Status) VALUES (?,?,?,?,?,?)',['2026-04-01','2026-10-26','KR_2026-2027 staged source totals',hash,'D:\\PROJECT\\shop_new_ui\\doc_work\\backups\\stores-before-august-repair-2026-10-28T05-45-40-856Z.sql','Verified']);
 const [r]=await c.query('SELECT COUNT(*) items,SUM(OpeningQty) qty FROM stock_opening_snapshots');const [i]=await c.query('SELECT SUM(Quantity) closing_qty FROM items');console.log(JSON.stringify({snapshot:r[0],items:i[0],fingerprint:hash}));await c.commit();
 }catch(e){await c.rollback();throw e;}
}finally{await c.end();}}
main().catch(e=>{console.error(e.message);process.exitCode=1});
