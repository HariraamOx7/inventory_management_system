const assert=require('node:assert/strict');
module.exports=async function(models,check){
 const made=[], ids={}, bodies={};
 async function call(model,controller,methods,param,body,field,base){
  const c=require('../controllers/'+controller+'Controller'), M=models[model];
  const respond=()=>({statusCode:200,status(n){this.statusCode=n;return this},json(v){this.body=v;return this}});
  let id;
  await check('BUSINESS '+model+' create',async()=>{const r=respond();await c[methods[0]]({body},r);assert.equal(r.statusCode,201,JSON.stringify(r.body));id=r.body.data[M.primaryKeyAttribute];assert.ok(id!=null);assert.ok(await M.findByPk(id));ids[model]=id;bodies[model]=body;made.push({M,c,methods,param,id,model,base});});
  if(id==null)return;
  await check('BUSINESS '+model+' update persistence',async()=>{const r=respond(),next={...body,[field]:'Audit updated'};await c[methods[1]]({body:next,params:{[param]:id}},r);assert.equal(r.statusCode,200,JSON.stringify(r.body));assert.equal((await M.findByPk(id))[field],'Audit updated');});
 }
 const d='2026-10-29';
 await call('Department','department',['addDepartment','updateDepartment','deleteDepartment'],'dept_id',{dept_name:'Audit department'},'dept_name');
 const dep=await models.Department.findByPk(ids.Department);
 await call('SubHead','subHead',['addSubHead','updateSubHead','deleteSubHead'],'code',{sub_group_name:'Audit sub',department_id:ids.Department},'sub_group_name');
 await call('UOM','uom',['addUom','updateUom','deleteUom'],'id',{uom:'NOS'},'uom');
 await call('State','state',['addState','updateState','deleteState'],'code',{StateName:'Audit state'},'StateName');
 await call('StoreMaster','storeMaster',['addStore','updateStore','deleteStore'],'id',{StoreCode:'AUD',StoreName:'Audit store'},'StoreName');
 await call('ProductHead','prodHead',['addProductHead','updateProductHead','deleteProductHead'],'code',{ProdHeadCode:'AUD',ProdHeadDesc:'Audit head'},'ProdHeadDesc');
 await call('Supplier','supplier',['addSupplier','updateSupplier','deleteSupplier'],'partyCode',{PartyCode:'AUD',AccountName:'Audit supplier'},'AccountName');
 await call('PartyMaster','partyMaster',['addParty','updateParty','deleteParty'],'code',{Code:'AUD',PartyCode:'AUD',AccCode:'AUD',AccountName:'Audit party',PartyName:'Audit party'},'AccountName');
 await call('PurchaseType','purchaseType',['addPurchaseType','updatePurchaseType','deletePurchaseType'],'code',{PurchaseType:'Audit type',Description:'Audit purchase'},'Description');
 await call('ItemMaster','itemMaster',['addItemMaster','updateItemMaster','deleteItemMaster'],'code',{ItemCode:'AUD_MASTER',ItemName:'Audit master',UnitRate:10},'ItemName');
 await call('Item','item',['addItem','updateItem','deleteItem'],'code',{ItemName:'Audit item',DepartmentId:ids.Department,SubHeadCode:ids.SubHead,Quantity:100,OpeningQty:100,UnitRate:10,UOM:'NOS'},'Location');
 const item=await models.Item.findByPk(ids.Item);
 const line={ItemCode:ids.Item,ItemName:item?.ItemName,Qty:10,UnitRate:10,TotalAmount:100,GrandTotal:100,PendingQty:10,ReceivedQty:10};
 const common={PartyCode:ids.Supplier,PartyName:'Audit updated',items:[line],Total:100,GrandTotal:100};
 await call('PurchaseOrder','purchaseOrder',['createPurchaseOrder','updatePurchaseOrder','deletePurchaseOrder'],'orderNo',{...common,OrderDate:d},'Remarks');
 line.OrderNo=ids.PurchaseOrder;
 await call('GateInward','gateInward',['createGateInward','updateGateInward','deleteGateInward'],'inwardNo',{...common,InwardDate:d,InvoiceNo:'AUD1'},'InvoiceNo');
 await call('Receipt','receipt',['createReceipt','updateReceipt','deleteReceipt'],'grnNo',{...common,GateInwardNo:ids.GateInward,InwardDate:d},'DCNo');
 await call('BillEntry','billEntry',['createBillEntry','updateBillEntry','deleteBillEntry'],'voucherNo',{...common,GateInwardNo:ids.GateInward,GRNNo:ids.Receipt,PurchaseType:ids.PurchaseType,AccDate:d,BillDate:d,PartyBillNo:'AUD1'},'Narration');
 await call('BillVerify','billVerify',['createBillVerify','updateBillVerify','deleteBillVerify'],'verifyNo',{VoucherNo:ids.BillEntry,BillNo:1001,PartyName:'Audit supplier',BillDate:d},'Remarks');
 await call('ItemIssue','itemIssue',['createItemIssue','updateItemIssue','deleteItemIssue'],'issueNo',{IssueDate:d,Department:dep?.dept_name,items:[{...line,Qty:1}]},'Remarks');
 await call('GatePassOut','gatePassOut',['createGatePassOut','updateGatePassOut','deleteGatePassOut'],'gpNo',{PartyName:'Audit supplier',GpDate:d,items:[{...line,Qty:1}]},'Remarks');
 await call('GatePassIn','gatePassIn',['createGatePassIn','updateGatePassIn','deleteGatePassIn'],'inNo',{PartyName:'Audit supplier',GiDate:d,items:[{...line,GpNo:ids.GatePassOut,RecQty:1}]},'DcNo');
 await call('CancelOrder','cancelOrder',['createCancelOrder','updateCancelOrder','deleteCancelOrder'],'cancelNo',{OrderNo:ids.PurchaseOrder,PartyName:'Audit supplier',CancelDate:d,Reason:'Audit'},'Reason');
 for(const x of made.reverse())await check('BUSINESS '+x.model+' delete persistence',async()=>{const r=respondDelete();await x.c[x.methods[2]]({params:{[x.param]:x.id},body:{}},r);assert.equal(r.statusCode,200,JSON.stringify(r.body));assert.equal(await x.M.findByPk(x.id),null);});
 function respondDelete(){return {statusCode:200,status(n){this.statusCode=n;return this},json(v){this.body=v;return this}}}
};

