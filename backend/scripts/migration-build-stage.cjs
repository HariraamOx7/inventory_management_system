// Build a fresh isolated stage and fail if SQL Server data changes during extraction.
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const stage=process.env.MIGRATION_STAGE;
if(!/^stores_stage_[a-z0-9_]+$/.test(stage||''))throw new Error('A new isolated stage name is required');
const tables=['AccountsMaster','DepartmentMaster','ItemMas','SubHeadMas','UomMaster','State','PurchaseTypeMaster','PurchaseOrderHead','PurchaseOrderDetail','GateInwardHead','GateInwardDetail','StoreReceiptHead','StoreReceiptDetail','StoreBillHead','StoreBillDetail','StoreBillGrnDetail','StoreIssHead','StoreIssDetail','GPOutPassHead','GPOutPassDetail','GPAccountsMaster'];
function fingerprint(){const sql='SET NOCOUNT ON; '+tables.map(t=>`SELECT '${t}' AS table_name, COUNT_BIG(*) AS row_count, CHECKSUM_AGG(BINARY_CHECKSUM(*)) AS checksum_value FROM dbo.[${t}]`).join(' UNION ALL ')+' ORDER BY table_name';return execFileSync('sqlcmd',['-S','.\\SQLEXPRESS','-E','-d','KR_2026-2027','-h','-1','-W','-s','|','-b','-Q',sql],{encoding:'utf8',maxBuffer:10*1024*1024}).trim();}
const env={...process.env,DB_HOST:'127.0.0.1',DB_NAME:stage,MIGRATION_STAGE:stage};
function run(script){console.log(`Running ${script}`);execFileSync(process.execPath,[`scripts/${script}`],{env,stdio:'inherit'});}
try{const before=fingerprint();for(const script of ['migration-stage-masters.cjs','migration-stage-transactions.cjs','migration-stage-bill-values.cjs','migration-stage-gate-passes.cjs','migration-stage-constraints.cjs','migration-stage-stock.cjs','migration-inward-valuation.cjs','migration-stage-status.cjs','migration-seal-stage.cjs'])run(script);const after=fingerprint();if(before!==after)throw new Error('SQL Server source changed during staging; do not use this stage');run('migration-reconcile-stock.cjs');const manifest=path.resolve(__dirname, '../../../../doc_work', `${stage}-source-fingerprint.json`);fs.writeFileSync(manifest,JSON.stringify({stage,tables,fingerprint:after},null,2),{flag:'wx'});console.log(`Source counts and checksums unchanged; manifest: ${manifest}`);}catch(error){console.error(error.message);process.exitCode=1;}
