const {execFileSync}=require('node:child_process');
const mysql=require('mysql2/promise');
require('dotenv').config({quiet:true});
const stage=process.env.MIGRATION_STAGE;
if(!/^stores_stage_[a-z0-9_]+$/.test(stage||'')) throw new Error('An isolated staging database is required');
function source(query){const output=execFileSync('sqlcmd',['-S','.\\SQLEXPRESS','-E','-d','KR_2026-2027','-y','0','-w','65535','-b','-Q',`SET NOCOUNT ON; ${query} FOR JSON PATH, INCLUDE_NULL_VALUES`],{encoding:'utf8',maxBuffer:20*1024*1024});const start=output.indexOf('[');if(start<0)throw new Error('Missing JSON');return JSON.parse(output.slice(start).trim().replace(/\r?\n/g,''));}
async function main(){const c=await mysql.createConnection({host:'127.0.0.1',user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:stage});try{
 for(const t of ['gate_pass_outs','gate_pass_out_details']){const [r]=await c.query('SELECT COUNT(*) n FROM ??',[t]);if(r[0].n)throw new Error(`${t} already populated`);}
 const heads=source(`SELECT h.GPNo GpNo,h.GPdate GpDate,a.PartyName,CONCAT_WS(', ',NULLIF(h.Address1,''),NULLIF(h.Address2,''),NULLIF(h.Address3,'')) Address,d.DeptName Department,h.[Through] DespatchThrough,h.Remarks,CASE WHEN UPPER(h.Returnable)='RETURNABLE' THEN 'Yes' WHEN UPPER(h.Returnable) IN ('NON RETURNABLE','NON-RETURNABLE') THEN 'No' ELSE NULL END Returnable,h.GPRefNO GpRefNo FROM dbo.GPOutPassHead h LEFT JOIN dbo.GPAccountsMaster a ON a.AccCode=h.AccCode LEFT JOIN dbo.DepartmentMaster d ON d.Code=h.DeptCode`);
 const details=source('SELECT GPNo GpNo,ItemName,Qty,Reason FROM dbo.GPOutPassDetail');
 await c.beginTransaction();try{for(const [table,rows] of [['gate_pass_outs',heads],['gate_pass_out_details',details]]){for(const row of rows){if(table==='gate_pass_outs'&&(!row.PartyName||!row.Returnable))throw new Error(`Unmapped gate pass ${row.GpNo}`);row.createdAt=new Date();row.updatedAt=row.createdAt;await c.query('INSERT INTO ?? SET ?',[table,row]);}console.log(`${table}: ${rows.length}`);}await c.commit();}catch(e){await c.rollback();throw e;}
}finally{await c.end();}}
main().catch(e=>{console.error(e.message);process.exitCode=1});
