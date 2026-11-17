const test=require('node:test');
const assert=require('node:assert/strict');
const resolve=require('../services/resolveItemCode');
test('legacy alphanumeric codes and leading zeros survive',async()=>{const noLookup={findOne(){throw new Error('unexpected lookup');}};assert.equal(await resolve(noLookup,' 17/25/Ot/10866 ',null),'17/25/Ot/10866');assert.equal(await resolve(noLookup,'00012',null),'00012');});
test('name lookup remains available when no code is provided',async()=>{const model={async findAll(query){assert.equal(query.where.ItemName,'SHAFT');return [{ItemCode:'01/08/Bl/0241'}];}};assert.equal(await resolve(model,null,' SHAFT '),'01/08/Bl/0241');});

test('duplicate names require an explicit item code',async()=>{const model={async findAll(){return [{ItemCode:'A'},{ItemCode:'B'}]}};await assert.rejects(resolve(model,null,'Duplicate'),error=>error.statusCode===400);assert.equal(await resolve(model,'B','Duplicate'),'B');});
