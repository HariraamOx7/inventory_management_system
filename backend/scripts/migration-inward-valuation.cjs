// Add and backfill the approved valuation columns in an isolated migration copy.
const mysql=require('mysql2/promise');
require('dotenv').config({quiet:true});
const schema=process.env.MIGRATION_STAGE;
if(!/^stores_(stage|rehearsal)_[a-z0-9_]+$/.test(schema||''))throw new Error('Only an isolated migration database is allowed');
async function main(){const c=await mysql.createConnection({host:'127.0.0.1',user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:schema});try{
 const [existing]=await c.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='gate_inward_details' AND COLUMN_NAME IN ('StockUnitRate','StockValue')",[schema]);
 if(existing.length)throw new Error('Valuation columns already exist; inspect before retrying');
 const [ambiguous]=await c.query(`SELECT COUNT(*) n FROM (SELECT g.DetailId,COUNT(r.DetailId) cnt FROM gate_inward_details g LEFT JOIN receipt_details r JOIN receipts h ON h.GRNNo=r.GRNNo ON h.GateInwardNo=g.InwardNo AND r.OrderNo=g.OrderNo AND r.ItemCode=g.ItemCode GROUP BY g.DetailId HAVING COUNT(r.DetailId)<>1) x`);
 if(ambiguous[0].n)throw new Error(`${ambiguous[0].n} legacy inward lines lack a unique receipt match`);
 await c.query('ALTER TABLE gate_inward_details ADD COLUMN StockUnitRate DECIMAL(20,8) NULL, ADD COLUMN StockValue DECIMAL(20,6) NULL');
 await c.beginTransaction();try{const [r]=await c.query(`UPDATE gate_inward_details g JOIN receipts h ON h.GateInwardNo=g.InwardNo JOIN receipt_details d ON d.GRNNo=h.GRNNo AND d.OrderNo=g.OrderNo AND d.ItemCode=g.ItemCode SET g.StockUnitRate=d.StockUnitRate,g.StockValue=d.StockValue`);const [missing]=await c.query('SELECT COUNT(*) n FROM gate_inward_details WHERE StockUnitRate IS NULL OR StockValue IS NULL');if(missing[0].n)throw new Error('Missing legacy stock costs');await c.commit();console.log(JSON.stringify({schema,backfilled:r.affectedRows}));}catch(e){await c.rollback();throw e;}
}finally{await c.end();}}
main().catch(e=>{console.error(e.message);process.exitCode=1});
