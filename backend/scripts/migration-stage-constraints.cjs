// Recreate the target's single and composite foreign keys on the isolated stage.
const mysql=require('mysql2/promise');
require('dotenv').config({quiet:true});
const stage=process.env.MIGRATION_STAGE;
if(!/^stores_stage_[a-z0-9_]+$/.test(stage||''))throw new Error('An isolated stage is required');
async function main(){const c=await mysql.createConnection({host:'127.0.0.1',user:process.env.DB_USER,password:process.env.DB_PASSWORD});try{
 const [rows]=await c.query(`SELECT k.TABLE_NAME,k.CONSTRAINT_NAME,k.COLUMN_NAME,k.REFERENCED_TABLE_NAME,k.REFERENCED_COLUMN_NAME,k.ORDINAL_POSITION,r.UPDATE_RULE,r.DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.CONSTRAINT_SCHEMA='stores' AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.TABLE_NAME,k.CONSTRAINT_NAME,k.ORDINAL_POSITION`);
 const groups=new Map();for(const row of rows){const key=row.TABLE_NAME+'|'+row.CONSTRAINT_NAME;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 const id=mysql.escapeId;
 for(const group of groups.values()){const f=group[0];const [existing]=await c.query('SELECT COUNT(*) n FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND TABLE_NAME=? AND CONSTRAINT_NAME=?',[stage,f.TABLE_NAME,f.CONSTRAINT_NAME]);if(existing[0].n){console.log(`${f.CONSTRAINT_NAME}: already present`);continue;}const cols=group.map(x=>id(x.COLUMN_NAME)).join(',');const refs=group.map(x=>id(x.REFERENCED_COLUMN_NAME)).join(',');const rules=['RESTRICT','CASCADE','SET NULL','NO ACTION'];if(!rules.includes(f.UPDATE_RULE)||!rules.includes(f.DELETE_RULE))throw new Error('Unsupported foreign key action');await c.query(`ALTER TABLE ${id(stage)}.${id(f.TABLE_NAME)} ADD CONSTRAINT ${id(f.CONSTRAINT_NAME)} FOREIGN KEY (${cols}) REFERENCES ${id(stage)}.${id(f.REFERENCED_TABLE_NAME)} (${refs}) ON UPDATE ${f.UPDATE_RULE} ON DELETE ${f.DELETE_RULE}`);console.log(`${f.CONSTRAINT_NAME}: validated`);}
}finally{await c.end();}}
main().catch(e=>{console.error(e.message);process.exitCode=1});
