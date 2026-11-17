// Seal a reconciled, isolated migration stage with a full ledger fingerprint.
require('dotenv').config({quiet:true});
if(!/^stores_(stage|rehearsal)_[a-z0-9_]+$/.test(process.env.DB_NAME||'')) throw new Error('Only an isolated migration database can be sealed');
const db=require('../config/db');
const {calculateMigratedLedgerHash}=require('../services/historicalStock');
async function main(){const transaction=await db.transaction({isolationLevel:'SERIALIZABLE'});try{const hash=await calculateMigratedLedgerHash({from:'2026-04-01',transaction});const [,meta]=await db.query("UPDATE stock_history_batches SET SourceHash=:hash,createdAt=NOW() WHERE SnapshotDate='2026-04-01' AND SourceName='KR_2026-2027 staged source totals'",{replacements:{hash},transaction});if(meta.affectedRows!==1)throw new Error('Expected exactly one migrated snapshot');await transaction.commit();console.log(JSON.stringify({sealed:true,hash}));}catch(e){await transaction.rollback();throw e;}finally{await db.close();}}
main().catch(e=>{console.error(e.message);process.exitCode=1});
