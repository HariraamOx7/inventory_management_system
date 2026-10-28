// Writes only uniquely identified fixtures in an isolated rehearsal database.
const test=require('node:test');
const assert=require('node:assert/strict');
require('dotenv').config({quiet:true});
if(!/^stores_rehearsal_[a-z0-9_]+$/.test(process.env.DB_NAME||''))throw new Error('A rehearsal database is required');
const {sequelize,Item,Supplier,PurchaseOrder,PurchaseOrderDetail,GateInward,GateInwardDetail,ItemIssue,ItemIssueDetail}=require('../models');
const inward=require('../controllers/gateInwardController');
const {getMigratedCurrentStock,getHistoricalDepartmentStock}=require('../services/historicalStock');
const code='ZZ_MIGRATION_FLOW_TEST', party='ZZ_MIGRATION_FLOW_TEST', orderNo=1999990011, issueNo=1999990012;
function response(){return {statusCode:200,body:null,status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
test('new inward retains cost across PO price edits, contributes to ledger and reverses',async()=>{
 assert.equal(await Item.count({where:{ItemCode:code}}),0);assert.equal(await Supplier.count({where:{PartyCode:party}}),0);assert.equal(await PurchaseOrder.count({where:{OrderNo:orderNo}}),0);assert.equal(await ItemIssue.count({where:{IssueNo:issueNo}}),0);
 let inwardNo;
 try {
  await Item.create({ItemCode:code,ItemName:'Migration flow test',Quantity:0,OpeningQty:0,UnitRate:0});
  await Supplier.create({PartyCode:party,AccountName:'Migration flow test'});
  await PurchaseOrder.create({OrderNo:orderNo,OrderDate:'2026-10-27',PartyCode:party,Status:'Draft'});
  await PurchaseOrderDetail.create({OrderNo:orderNo,ItemCode:code,Qty:10,UnitRate:10,TotalAmount:100,DiscountAmt:0});
  let res=response();await inward.createGateInward({body:{PartyCode:party,InwardDate:'2026-10-27',items:[{OrderNo:orderNo,ItemCode:code,PendingQty:10,ReceivedQty:5}]}},res);
  assert.equal(res.statusCode,201,JSON.stringify(res.body));inwardNo=res.body.data.InwardNo;
  let detail=await GateInwardDetail.findOne({where:{InwardNo:inwardNo},raw:true});assert.equal(Number(detail.StockUnitRate),10);assert.equal(Number(detail.StockValue),50);
  await PurchaseOrderDetail.update({UnitRate:40,TotalAmount:400},{where:{OrderNo:orderNo}});
  res=response();await inward.updateGateInward({params:{inwardNo},body:{items:[{OrderNo:orderNo,ItemCode:code,PendingQty:10,ReceivedQty:4}]}},res);assert.equal(res.statusCode,200,JSON.stringify(res.body));
  detail=await GateInwardDetail.findOne({where:{InwardNo:inwardNo},raw:true});assert.equal(Number(detail.StockUnitRate),10);assert.equal(Number(detail.StockValue),40);
  await ItemIssue.create({IssueNo:issueNo,IssueDate:'2026-10-27',Department:'Migration test'});
  await ItemIssueDetail.create({IssueNo:issueNo,ItemCode:code,ItemName:'Migration flow test',Qty:2,UnitRate:10,TotalAmount:20});
  await Item.update({Quantity:2,OpeningQty:2},{where:{ItemCode:code}});
  const ledger=await getMigratedCurrentStock();const line=ledger.itemBalances.find(i=>i.itemCode===code);assert.equal(line.quantity,2);assert.equal(line.value,20);assert.equal(ledger.reportTotalValue,7648082.55);
  const day=await getHistoricalDepartmentStock({from:'2026-10-27',to:'2026-10-27'});assert.equal(day.totals.receivedQty,4);assert.equal(day.totals.receivedValue,40);assert.equal(day.totals.issueQty,2);assert.equal(day.totals.issueValue,20);assert.equal(day.totals.closingValue,7648082.55);
  await ItemIssueDetail.destroy({where:{IssueNo:issueNo}});await ItemIssue.destroy({where:{IssueNo:issueNo}});await Item.update({Quantity:4,OpeningQty:4},{where:{ItemCode:code}});
  res=response();await inward.deleteGateInward({params:{inwardNo}},res);assert.equal(res.statusCode,200,JSON.stringify(res.body));inwardNo=null;
  assert.equal(Number((await Item.findByPk(code)).Quantity),0);
 } finally {
  await ItemIssueDetail.destroy({where:{IssueNo:issueNo}});await ItemIssue.destroy({where:{IssueNo:issueNo}});
  if(inwardNo){await GateInwardDetail.destroy({where:{InwardNo:inwardNo,OrderNo:orderNo}});await GateInward.destroy({where:{InwardNo:inwardNo,OrderNo:orderNo}});}
  await PurchaseOrderDetail.destroy({where:{OrderNo:orderNo}});await PurchaseOrder.destroy({where:{OrderNo:orderNo,PartyCode:party}});await Supplier.destroy({where:{PartyCode:party}});await Item.destroy({where:{ItemCode:code}});
 }
});
test.after(async()=>{await sequelize.close();});
