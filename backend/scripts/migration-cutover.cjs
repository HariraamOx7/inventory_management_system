// Atomic replacement of the explicitly authorized target from a verified stage.
// Schema ALTER is necessarily outside the transaction; the dump remains the recovery path.
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const mysql=require('mysql2/promise');
require('dotenv').config({quiet:true});
const stage=process.env.MIGRATION_STAGE,target=process.env.MIGRATION_TARGET,backup=process.env.MIGRATION_BACKUP;
if(!/^stores_stage_[a-z0-9_]+$/.test(stage||'') || !(target==='stores'||/^stores_rehearsal_[a-z0-9_]+$/.test(target||''))) throw new Error('Explicit stores target and isolated stage required');
const expectedDir=path.resolve(__dirname,'../../../../doc_work/backups');
const backupPath=path.resolve(backup||'');
if(path.dirname(backupPath)!==expectedDir || !fs.existsSync(backupPath))throw new Error('A fresh workspace stores backup is required');
const stat=fs.statSync(backupPath),dump=fs.readFileSync(backupPath,'utf8');
if(stat.size<1000||Date.now()-stat.mtimeMs>10*60*1000||!dump.includes('Database: stores')||!dump.includes('-- Dump completed on'))throw new Error('The stores backup is stale, incomplete, or for a different database');
const manifestPath=path.resolve(__dirname,'../../../../doc_work',`${stage}-source-fingerprint.json`);
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(manifest.stage!==stage||!Array.isArray(manifest.tables)||manifest.tables.some(t=>!/^[A-Za-z0-9_]+$/.test(t)))throw new Error('Invalid stage manifest');
function fingerprint(){const sql='SET NOCOUNT ON; '+manifest.tables.map(t=>`SELECT '${t}' AS table_name, COUNT_BIG(*) AS row_count, CHECKSUM_AGG(BINARY_CHECKSUM(*)) AS checksum_value FROM dbo.[${t}]`).join(' UNION ALL ')+' ORDER BY table_name';return execFileSync('sqlcmd',['-S','.\\SQLEXPRESS','-E','-d','KR_2026-2027','-h','-1','-W','-s','|','-b','-Q',sql],{encoding:'utf8',maxBuffer:10*1024*1024}).trim();}
const id=mysql.escapeId;
async function main(){
 if(fingerprint()!==manifest.fingerprint)throw new Error('SQL Server source changed since the final stage was built');
 process.env.DB_NAME=stage;process.env.DB_HOST='127.0.0.1';
 const stageDb=require('../config/db');const {getMigratedCurrentStock}=require('../services/historicalStock');
 try{const report=await getMigratedCurrentStock();if(!report||report.toDate!=='2026-10-26')throw new Error('Stage stock verification failed');}finally{await stageDb.close();}
 const c=await mysql.createConnection({host:'127.0.0.1',user:process.env.DB_USER,password:process.env.DB_PASSWORD});let altered=false;
 try{
  const [server]=await c.query('SELECT CONNECTION_ID() connection_id,@@port port');if(Number(server[0].port)!==3306)throw new Error('Unexpected MySQL port');
  const [busy]=await c.query('SELECT ID,DB FROM information_schema.PROCESSLIST WHERE DB IN (?,?) AND ID<>CONNECTION_ID()',[target,stage]);if(busy.length)throw new Error('Another connection is using the target or stage');
  const [tables]=await c.query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME",[target]);
  const [staged]=await c.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME",[stage]);
  if(!tables.length||tables.some(t=>t.ENGINE!=='InnoDB')||JSON.stringify(tables.map(t=>t.TABLE_NAME))!==JSON.stringify(staged.map(t=>t.TABLE_NAME)))throw new Error('Target and stage tables or transactional engines do not match');
  const [keys]=await c.query(`SELECT k.TABLE_NAME,k.REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE k WHERE k.CONSTRAINT_SCHEMA=? AND k.REFERENCED_TABLE_NAME IS NOT NULL`,[target]);
  const left=new Set(tables.map(t=>t.TABLE_NAME)),ordered=[];while(left.size){const ready=[...left].filter(t=>keys.filter(k=>k.TABLE_NAME===t&&k.REFERENCED_TABLE_NAME!==t).every(k=>!left.has(k.REFERENCED_TABLE_NAME)));if(!ready.length)throw new Error('Foreign-key cycle');for(const t of ready){ordered.push(t);left.delete(t);}}
  const [columns]=await c.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='gate_inward_details' AND COLUMN_NAME IN ('StockUnitRate','StockValue')",[target]);
  if(columns.length===0){await c.query('ALTER TABLE ??.gate_inward_details ADD COLUMN StockUnitRate DECIMAL(20,8) NULL, ADD COLUMN StockValue DECIMAL(20,6) NULL',[target]);altered=true;}else if(columns.length!==2)throw new Error('Target has an incomplete inward valuation schema');
  for(const name of ordered){const [a]=await c.query('SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION',[target,name]);const [b]=await c.query('SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION',[stage,name]);if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(`Schema mismatch for ${name}`);}
  await c.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');await c.beginTransaction();
  try{
   for(const name of ordered)await c.query('SELECT COUNT(*) n FROM ??.?? FOR UPDATE',[target,name]);
   for(const name of [...ordered].reverse())await c.query('DELETE FROM ??.??',[target,name]);
   for(const name of ordered)await c.query('INSERT INTO ??.?? SELECT * FROM ??.??',[target,name,stage,name]);
   for(const name of ordered){const [a]=await c.query('SELECT COUNT(*) n FROM ??.??',[target,name]);const [b]=await c.query('SELECT COUNT(*) n FROM ??.??',[stage,name]);if(a[0].n!==b[0].n)throw new Error(`Row-count mismatch for ${name}`);}
   if(fingerprint()!==manifest.fingerprint)throw new Error('SQL Server source changed during cutover');
   await c.commit();console.log(JSON.stringify({target,stage,tables:ordered.length,backup:backupPath,status:'committed'}));
  }catch(e){await c.rollback();throw e;}
 }catch(e){if(altered)console.error('The two approved columns were added; data replacement rolled back or did not start.');throw e;}finally{await c.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
