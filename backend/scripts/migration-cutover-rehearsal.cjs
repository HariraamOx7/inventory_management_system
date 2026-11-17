// Rehearse full deletion and replacement on a new isolated clone of stores.
// This script cannot write to stores or to the source staging schema.
const mysql=require('mysql2/promise');
require('dotenv').config({quiet:true});
const stage=process.env.MIGRATION_STAGE, rehearsal=process.env.MIGRATION_REHEARSAL;
if(!/^stores_stage_[a-z0-9_]+$/.test(stage||'')||!/^stores_rehearsal_[a-z0-9_]+$/.test(rehearsal||''))throw new Error('Distinct isolated stage and rehearsal names are required');
const id=mysql.escapeId;
async function main(){const c=await mysql.createConnection({host:'127.0.0.1',user:process.env.DB_USER,password:process.env.DB_PASSWORD});try{
 const [exists]=await c.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',[rehearsal]);if(exists.length)throw new Error('Rehearsal database already exists');
 const [tables]=await c.query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA='stores' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
 if(!tables.length||tables.some(t=>t.ENGINE!=='InnoDB'))throw new Error('All target tables must be InnoDB');
 const [stageTables]=await c.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME",[stage]);
 if(JSON.stringify(tables.map(t=>t.TABLE_NAME))!==JSON.stringify(stageTables.map(t=>t.TABLE_NAME)))throw new Error('Stage and target tables differ');
 const [keys]=await c.query(`SELECT k.TABLE_NAME,k.CONSTRAINT_NAME,k.COLUMN_NAME,k.REFERENCED_TABLE_NAME,k.REFERENCED_COLUMN_NAME,k.ORDINAL_POSITION,r.UPDATE_RULE,r.DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.CONSTRAINT_SCHEMA='stores' AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.TABLE_NAME,k.CONSTRAINT_NAME,k.ORDINAL_POSITION`);
 const keyGroups=new Map();for(const r of keys){const k=r.TABLE_NAME+'|'+r.CONSTRAINT_NAME;if(!keyGroups.has(k))keyGroups.set(k,[]);keyGroups.get(k).push(r);}
 const remaining=new Set(tables.map(t=>t.TABLE_NAME)),ordered=[];
 while(remaining.size){const ready=[...remaining].filter(t=>keys.filter(k=>k.TABLE_NAME===t&&k.REFERENCED_TABLE_NAME!==t).every(k=>!remaining.has(k.REFERENCED_TABLE_NAME)));if(!ready.length)throw new Error('Foreign-key cycle prevents a safe ordered replacement');for(const t of ready){ordered.push(t);remaining.delete(t);}}
 await c.query('CREATE DATABASE ?? CHARACTER SET utf8mb4',[rehearsal]);
 for(const name of ordered)await c.query('CREATE TABLE ??.?? LIKE stores.??',[rehearsal,name,name]);
 await c.query('ALTER TABLE ??.gate_inward_details ADD COLUMN StockUnitRate DECIMAL(20,8) NULL, ADD COLUMN StockValue DECIMAL(20,6) NULL',[rehearsal]);
 for(const group of keyGroups.values()){const f=group[0],cols=group.map(k=>id(k.COLUMN_NAME)).join(','),refs=group.map(k=>id(k.REFERENCED_COLUMN_NAME)).join(',');const rules=['CASCADE','RESTRICT','NO ACTION','SET NULL'];if(!rules.includes(f.UPDATE_RULE)||!rules.includes(f.DELETE_RULE))throw new Error('Unsupported key rule');await c.query(`ALTER TABLE ${id(rehearsal)}.${id(f.TABLE_NAME)} ADD CONSTRAINT ${id(f.CONSTRAINT_NAME)} FOREIGN KEY (${cols}) REFERENCES ${id(rehearsal)}.${id(f.REFERENCED_TABLE_NAME)} (${refs}) ON UPDATE ${f.UPDATE_RULE} ON DELETE ${f.DELETE_RULE}`);}
 for(const name of ordered){const [cols]=await c.query('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION',['stores',name]);const fields=cols.map(x=>id(x.COLUMN_NAME)).join(',');await c.query(`INSERT INTO ${id(rehearsal)}.${id(name)} (${fields}) SELECT ${fields} FROM stores.${id(name)}`);}
 await c.beginTransaction();try{for(const name of [...ordered].reverse())await c.query('DELETE FROM ??.??',[rehearsal,name]);for(const name of ordered)await c.query('INSERT INTO ??.?? SELECT * FROM ??.??',[rehearsal,name,stage,name]);for(const name of ordered){const [a]=await c.query('SELECT COUNT(*) n FROM ??.??',[rehearsal,name]);const [b]=await c.query('SELECT COUNT(*) n FROM ??.??',[stage,name]);if(a[0].n!==b[0].n)throw new Error('Count mismatch '+name);}await c.commit();console.log(JSON.stringify({database:rehearsal,tables:ordered.length,foreignKeys:keyGroups.size,status:'replacement committed and counts match stage'}));}catch(e){await c.rollback();throw e;}
}finally{await c.end();}}
main().catch(e=>{console.error(e.message);process.exitCode=1});
