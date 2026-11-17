#!/usr/bin/env node
// Creates its own disposable schema; never mutates the configured application schema.
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
require('dotenv').config({path:path.join(root,'.env'),quiet:true});
const mysql=require('mysql2/promise');
const database='stores_rehearsal_audit_'+Date.now();
const results=[];
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){results.push({name,status:'FAIL',error:e.message});console.log('FAIL '+name+': '+e.message);}}
function value(a,n){const t=a.type.key;if(t==='ENUM')return a.values?.[0]||a.type.values[0];if(t==='BOOLEAN')return true;if(t==='DATE')return new Date('2026-10-29T00:00:00Z');if(t==='DATEONLY')return '2026-10-29';if(/INT|DECIMAL|FLOAT|DOUBLE|REAL/.test(t))return n;if(t==='JSON')return {};return ('AUD'+n).slice(0,a.type.options?.length||30);}
async function main(){
 const admin=await mysql.createConnection({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT)||3306,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
 let created=false,sequelize;
 try{
  await admin.query('CREATE DATABASE `'+database+'`');created=true;process.env.DB_NAME=database;
  const models=require('../models');sequelize=models.sequelize;await sequelize.sync();
  const counts={};let serial=100;
  // Foreign keys are populated by recursively creating referenced model fixtures.
  async function seed(model,trail=new Set()){
   if(trail.has(model.name))throw Error('Cyclic required fixture: '+model.name);
   const seen=new Set(trail).add(model.name), body={};
   for(const [key,a] of Object.entries(model.rawAttributes)){
    if(a.autoIncrement||['createdAt','updatedAt'].includes(key))continue;
    if(a.references){
      if(a.allowNull!==false)continue;
      const table=typeof a.references.model==='string'?a.references.model:a.references.model.tableName;
      const parent=Object.values(models).find(m=>m?.getTableName&&m.getTableName()===table);
      if(!parent)throw Error('Unknown referenced table '+table);
      body[key]=(await seed(parent,seen))[a.references.key];
    }else if(a.allowNull===false||a.primaryKey)body[key]=value(a,++serial);
   }
   return model.create(body);
  }
  for(const model of Object.values(models).filter(m=>m?.rawAttributes)){
   await check('MODEL '+model.name+' insert/read/update/delete persistence',async()=>{
    const row=await seed(model);const where=Object.fromEntries(model.primaryKeyAttributes.map(k=>[k,row[k]]));
    assert.ok(await model.findOne({where}),'insert missing');
    const entry=Object.entries(model.rawAttributes).find(([k,a])=>!a.primaryKey&&!a.references&&!['createdAt','updatedAt'].includes(k)&&['STRING','TEXT','DECIMAL','INTEGER'].includes(a.type.key)&&k!=='email');
    assert.ok(entry,'No mutable fixture attribute');
    const [key,a]=entry, next=value(a,++serial);await model.update({[key]:next},{where});
    assert.equal(String((await model.findOne({where}))[key]),String(next),'update not persisted');
    await model.destroy({where});assert.equal(await model.count({where}),0,'delete not persisted');counts[model.name]=true;
   });
  }
  await require('./operation-business-cases.cjs')(models,check);
  await check('REGRESSION receipt and bill dropdowns distinguish suppliers with identical names', async () => {
   const receiptController = require('../controllers/receiptController');
   const billController = require('../controllers/billEntryController');
   const respond = () => ({statusCode:200,status(n){this.statusCode=n;return this},json(v){this.body=v;return this}});
   for (const code of ['DUP_A', 'DUP_B']) {
    await models.Supplier.create({PartyCode:code,AccountName:'Duplicate supplier'});
    await models.PurchaseOrder.create({PartyCode:code,OrderDate:'2026-10-29',Status:'Completed'});
    await models.Receipt.create({PartyCode:code,InwardDate:'2026-10-29'});
   }
   const poRes=respond();
   await receiptController.getAvailablePurchaseOrders({query:{partyCode:'DUP_B'}},poRes);
   assert.equal(poRes.statusCode,200);
   assert.equal(poRes.body.data.length,1);
   assert.equal(poRes.body.data[0].PartyCode,'DUP_B');
   const partyRes=respond();
   await billController.getAvailableParties({query:{includeCodes:'true'}},partyRes);
   assert.equal(partyRes.statusCode,200);
   assert.deepEqual(partyRes.body.data.filter(p=>p.name==='Duplicate supplier').map(p=>p.PartyCode).sort(),['DUP_A','DUP_B']);
   const grnRes=respond();
   await billController.getAvailableGRNs({query:{partyCode:'DUP_B'}},grnRes);
   assert.equal(grnRes.statusCode,200);
   assert.equal(grnRes.body.data.length,1);
   assert.equal(grnRes.body.data[0].PartyCode,'DUP_B');
   const legacy=respond();
   await billController.getAvailableParties({query:{}},legacy);
   assert.ok(legacy.body.data.includes('Duplicate supplier'));
  });

  await check('REGRESSION item updates preserve exact string codes and stock',async()=>{
   const controller=require('../controllers/itemController');
   const codes=['123','000123','123ABC'];
   try {
    for(const code of codes)await models.Item.create({ItemCode:code,ItemName:'Exact code '+code,Quantity:7,OpeningQty:7});
    for(const code of codes.slice(1)){
     const res={statusCode:200,status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};
     await controller.updateItem({params:{code},body:{Location:'Updated '+code,Quantity:999,OpeningQty:999}},res);
     assert.equal(res.statusCode,200,JSON.stringify(res.body));
     const row=await models.Item.findByPk(code);
     assert.equal(row.Location,'Updated '+code);
     assert.equal(Number(row.Quantity),7);
     assert.equal(Number(row.OpeningQty),7);
    }
    assert.equal((await models.Item.findByPk('123')).Location,null,'Numeric neighbour must remain unchanged');
   }finally{for(const code of codes)await models.Item.destroy({where:{ItemCode:code}});}
  });
  // Run mounted write handlers using their actual router parameter names.
  const source=fs.readFileSync(path.join(root,'server.js'),'utf8');
  const imports=new Map([...source.matchAll(/const\s+(\w+)\s*=\s*require\(['"]\.\/routes\/([^'"]+)['"]\)/g)].map(m=>[m[1],m[2]]));
  for(const m of source.matchAll(/app\.use\(['"](\/api\/[^'"]+)['"]\s*,\s*([^;]+)\)/g)){
   const name=[...imports.keys()].find(n=>new RegExp('\\b'+n+'\\b').test(m[2]));if(!name)continue;
   const router=require(path.join(root,'routes',imports.get(name)));
   for(const layer of router.stack||[]){if(!layer.route)continue;
    for(const method of ['post','put','patch','delete']){if(!layer.route.methods[method])continue;
     await check('ROUTE '+method.toUpperCase()+' '+m[1]+layer.route.path+' rejects invalid/missing record',async()=>{
      const params=Object.fromEntries([...layer.route.path.matchAll(/:(\w+)/g)].map(x=>[x[1],'1999999999']));
      const req={body:{},params,query:{},headers:{},user:{id:1999999999,role:'admin'},ip:'127.0.0.1'};
      const res={statusCode:200,body:null,status(n){this.statusCode=n;return this},json(v){this.body=v;return this},send(v){this.body=v;return this}};
      // Controller is last in each business route; middleware/auth tests require HTTP separately.
      await layer.route.stack.at(-1).handle(req,res);
      if(method==='put'&&m[1]==='/api/item-issues')assert.equal(res.statusCode,404,'Missing item issue must return 404');
      assert.ok(res.statusCode>=400&&res.statusCode<500,'Expected client rejection, got '+res.statusCode+' '+JSON.stringify(res.body));
     });
    }
   }
  }
 }finally{
  if(sequelize)await sequelize.close();
  if(created)await admin.query('DROP DATABASE `'+database+'`');
  await admin.end();
  const report={database,scope:'Model persistence CRUD and mounted write route invalid-input checks. Successful business workflows, HTTP middleware, UI, concurrency and stock invariants are not covered by this runner.',results};
  fs.writeFileSync(path.join(__dirname,'operation-audit-results.json'),JSON.stringify(report,null,2));
 }
 const failed=results.filter(r=>r.status==='FAIL').length;console.log(`${results.length-failed} passed; ${failed} failed. Disposable database removed.`);if(failed)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1});

