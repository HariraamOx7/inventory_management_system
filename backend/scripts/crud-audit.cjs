#!/usr/bin/env node
// CRUD audit: inventory all mounted write routes; exercise supported controllers only
// against a disposable database. See CRUD_AUDIT.md before running.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const imports = new Map([...server.matchAll(/const\s+(\w+)\s*=\s*require\(['"]\.\/routes\/([^'"]+)['"]\)/g)].map(m => [m[1], m[2]]));
const mounts = [...server.matchAll(/app\.use\(['"](\/api\/[^'"]+)['"]\s*,\s*([^;]+)\)/g)].map(m => ({base:m[1], name:[...imports.keys()].find(n => new RegExp(`\\b${n}\\b`).test(m[2]))})).filter(m => m.name);
const routes = [];
for (const {base,name} of mounts) {
  const router = require(path.join(root, 'routes', imports.get(name)));
  for (const layer of router.stack || []) {
    if (!layer.route) continue;
    for (const method of ['post','put','patch','delete']) {
      if (layer.route.methods[method]) routes.push(`${method.toUpperCase()} ${base}${layer.route.path === '/' ? '' : layer.route.path}`);
    }
  }
}
const cases = [
  {base:'/api/departments', param:'dept_id', model:'Department', controller:'departmentController', methods:['addDepartment','updateDepartment','deleteDepartment'], field:'dept_name', key:'dept_id'},
  {base:'/api/uoms', param:'id', model:'UOM', controller:'uomController', methods:['addUom','updateUom','deleteUom'], field:'uom', key:'id'},
  {base:'/api/states', param:'code', model:'State', controller:'stateController', methods:['addState','updateState','deleteState'], field:'StateName', key:'StateCode'},
  {base:'/api/purchase-types', param:'code', model:'PurchaseType', controller:'purchaseTypeController', methods:['addPurchaseType','updatePurchaseType','deletePurchaseType'], field:'PurchaseType', key:'Code'}
];
const covered = new Set(cases.flatMap(c => [`POST ${c.base}`, `PUT ${c.base}/:${c.param}`, `DELETE ${c.base}/:${c.param}`]));
function response() { return {statusCode:200, body:null, status(n){this.statusCode=n;return this;}, json(v){this.body=v;return this;}, send(v){this.body=v;return this;}}; }
async function invoke(fn, req) { const res=response(); await fn(req,res); return res; }
async function main() {
  const uncovered = routes.filter(r => !covered.has(r));
  console.log(`Discovered ${routes.length} mounted write routes; ${routes.length-uncovered.length} have CRUD scenarios; ${uncovered.length} are not covered.`);
  for (const route of uncovered) console.log(`UNTESTED ${route}`);
  if (process.argv.includes('--inventory')) return;
  require('dotenv').config({path:path.join(root,'.env'), quiet:true});
  if (!/^stores_rehearsal_[a-z0-9_]+$/.test(process.env.DB_NAME || '')) throw new Error('Set DB_NAME to a disposable stores_rehearsal_<name> database. Never run against live data.');
  const models = require('../models');
  const {sequelize} = models;
  let failures = 0;
  try {
    await sequelize.authenticate();
    const actual = await sequelize.query('SELECT DATABASE() AS name', {type: sequelize.QueryTypes.SELECT});
    assert.equal(actual[0].name, process.env.DB_NAME, 'Connected database does not match DB_NAME');
    for (const c of cases) {
      const model = models[c.model], controller = require('../controllers/'+c.controller);
      const tag = 'AUD' + crypto.randomBytes(5).toString('hex');
      let id;
      try {
        let res = await invoke(controller[c.methods[0]], {body:{[c.field]:tag}});
        assert.equal(res.statusCode, 201, `create: ${JSON.stringify(res.body)}`);
        id = res.body?.data?.[c.key];
        assert.ok(id != null, 'create did not return an identifier');
        let row = await model.findByPk(id);
        assert.ok(row, 'created row missing');
        assert.equal(row[c.field], tag);
        res = await invoke(controller[c.methods[1]], {params:{[c.param]:id}, body:{[c.field]:tag+'X'}});
        assert.equal(res.statusCode, 200, `update: ${JSON.stringify(res.body)}`);
        row = await model.findByPk(id);
        assert.equal(row[c.field], tag+'X', 'updated value not persisted');
        res = await invoke(controller[c.methods[2]], {params:{[c.param]:id}});
        assert.equal(res.statusCode, 200, `delete: ${JSON.stringify(res.body)}`);
        assert.equal(await model.findByPk(id), null, 'deleted row still present');
        id = undefined;
        res = await invoke(controller[c.methods[0]], {body:{}});
        assert.ok(res.statusCode >= 400 && res.statusCode < 500, `empty create should be rejected: ${res.statusCode}`);
        console.log(`PASS ${c.base}: create, update, delete, empty create validation`);
      } catch (error) { failures++; console.error(`FAIL ${c.base}: ${error.message}`); }
      finally {
        // Only remove a row if it is still identifiable as this run's fixture.
        if (id != null) {
          const row = await model.findByPk(id);
          if (row && [tag,tag+'X'].includes(row[c.field])) await row.destroy();
        }
      }
    }
  } finally { await sequelize.close(); }
  if (failures || uncovered.length) { console.error(`Audit incomplete: ${failures} failed scenarios, ${uncovered.length} untested routes.`); process.exitCode = 1; }
}
main().catch(error => { console.error(error.stack || error); process.exitCode=1; });
