// Import selected legacy transactions into an existing isolated staging database.
const { execFileSync } = require('node:child_process');
const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true });
const stage = process.env.MIGRATION_STAGE;
if (!/^stores_stage_[a-z0-9_]+$/.test(stage || '')) throw new Error('MIGRATION_STAGE must name an isolated stores_stage_ database');
function source(sql) {
  const text = execFileSync('sqlcmd', ['-S', '.\\SQLEXPRESS', '-E', '-d', 'KR_2026-2027', '-y', '0', '-w', '65535', '-b', '-Q', `SET NOCOUNT ON; ${sql} FOR JSON PATH, INCLUDE_NULL_VALUES`], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 });
  const start = text.indexOf('[');
  if (start < 0) throw new Error('Missing SQL Server JSON output');
  return JSON.parse(text.slice(start).trim().replace(/\r?\n/g, ''));
}
const imports = [
 ['sub_heads', `SELECT CONVERT(varchar(100),Code) code,Description sub_group_name,NULLIF(DeptCode,0) department_id FROM dbo.SubHeadMas`],
 ['uoms', `SELECT Id id,UOM uom FROM dbo.UomMaster`],
 ['states', `SELECT CONVERT(varchar(10),StateCode) StateCode,StateName FROM dbo.State`],
 ['purchase_types', `SELECT Code,PurchaseType,AssessValueFor AssessValue,RoundOffFor RoundOff,Duty1For Duty1,CommodityCode Commodity,TDSCode TDS,FreightFor LorryFreight,SGSTFor SGST,SGstCode SGSTLedger,CGSTFor CGST,CGstCode CGSTLedger,IGstFor IGST,IGstCode IGSTLedger,TCSFor TCS,TCSCode TCSLedger FROM dbo.PurchaseTypeMaster`],
 ['purchase_orders', `SELECT h.OrderNo,h.OrderDate,h.AccCode PartyCode,h.Address,h.Remarks,CONVERT(varchar(100),h.QtnNo) RefNo,COALESCE(SUM(d.TotalAmount),0) Total,COALESCE(SUM(d.DiscountAmount),0) Discount,COALESCE(SUM(d.SGST+d.CGST),0) GST,COALESCE(SUM(d.IGST),0) IGST,COALESCE(SUM(d.VatAmount),0) VAT_CST,COALESCE(SUM(d.PfAmount),0) P_F,COALESCE(SUM(d.LorryFreight),0) LorryFreight,COALESCE(SUM(d.Roundof),0) RoundOff,COALESCE(SUM(d.GrandTotal),0) GrandTotal,h.DutyWithoutPF,h.VoltasFormat,h.VatWithPf VatWithPF FROM dbo.PurchaseOrderHead h LEFT JOIN dbo.PurchaseOrderDetail d ON d.OrderNo=h.OrderNo GROUP BY h.OrderNo,h.OrderDate,h.AccCode,h.Address,h.Remarks,h.QtnNo,h.DutyWithoutPF,h.VoltasFormat,h.VatWithPf`],
 ['purchase_order_details', `SELECT OrderNo,ItemCode,Qty,UnitRate,TotalAmount,DiscountPer DiscountPct,DiscountAmount DiscountAmt,GSTType,GSTPer GSTPct,SGSTPer SGSTPct,SGST,CGSTPer CGSTPct,CGST,IGSTPer IGSTPct,IGST,CONVERT(varchar(50),TaxType) TaxType,VatPer TaxPct,VatAmount TaxAmount,Pfper PF_Pct,PfAmount PF_Amount,LorryFreight,Roundof RoundOff,GrandTotal,CONVERT(varchar(100),MRSNo) MRS_No FROM dbo.PurchaseOrderDetail`],
 ['gate_inwards', `SELECT h.InwardNo,MIN(d.OrderNo) OrderNo,h.PartyCode,h.InwardDate,h.InvoiceNo,h.InvoiceDate FROM dbo.GateInwardHead h JOIN dbo.GateInwardDetail d ON h.InwardNo=d.InwardNo GROUP BY h.InwardNo,h.PartyCode,h.InwardDate,h.InvoiceNo,h.InvoiceDate`],
 ['gate_inward_details', `SELECT InwardNo,OrderNo,ItemCode,Qty-ReceivedQty PendingQty,ReceivedQty FROM dbo.GateInwardDetail`],
 ['receipts', `SELECT h.GrnNo GRNNo,h.PartyCode,h.InwardNo GateInwardNo,h.GrnDate InwardDate,h.InvoiceNo,h.InvoiceDate,h.DcNo DCNo,h.DcDate DCDate,h.FormType,h.BillAmount,h.DutyWithoutPF,h.VatWithPF,h.GSTAmount GST,h.IGSTAmount IGST,COALESCE(SUM(d.TotalAmount),0) Total,COALESCE(SUM(d.DiscountAmount),0) Discount,COALESCE(SUM(d.TaxAmount),0) VAT_CST,COALESCE(SUM(d.PfAmount),0) P_F,COALESCE(SUM(d.LorryFreight),0) LorryFreight,COALESCE(SUM(d.roundof),0) RoundOff,COALESCE(SUM(d.GrandTotal),0) GrandTotal FROM dbo.StoreReceiptHead h LEFT JOIN dbo.StoreReceiptDetail d ON h.GrnNo=d.GrnNo GROUP BY h.GrnNo,h.PartyCode,h.InwardNo,h.GrnDate,h.InvoiceNo,h.InvoiceDate,h.DcNo,h.DcDate,h.FormType,h.BillAmount,h.DutyWithoutPF,h.VatWithPF,h.GSTAmount,h.IGSTAmount`],
 ['receipt_details', `SELECT GrnNo GRNNo,OrderNo,ItemCode,Qty,UnitRate,TotalAmount,CASE WHEN Qty<>0 THEN (TotalAmount+PfAmount+LorryFreight-DiscountAmount)/Qty ELSE NULL END StockUnitRate,TotalAmount+PfAmount+LorryFreight-DiscountAmount StockValue FROM dbo.StoreReceiptDetail`],
 ['bill_entries', `SELECT h.BillNo1 VoucherNo,d.GrnNo GRNNo,r.InwardNo GateInwardNo,h.PartyCode,h.AccDate,h.BillNo PartyBillNo,h.BillDate,CONVERT(varchar(100),h.PurchasetypeCode) PurchaseType,h.BillAmount,h.DutyWithoutPF,h.VatWithPF,h.VoltasFormat,h.GSTAmount GST,h.IGSTAmount IGST,h.TCS FROM dbo.StoreBillHead h JOIN dbo.StoreBillDetail d ON d.BillNo=h.BillNo1 LEFT JOIN dbo.StoreReceiptHead r ON r.GrnNo=d.GrnNo`],
 ['bill_entry_details', `SELECT BillNo VoucherNo,OrderNo,ItemCode,Qty,UnitRate,TotalAmount FROM dbo.StoreBillGrnDetail`],
 ['item_issues', `SELECT h.IssueNo,h.IssueDate,CONVERT(varchar(100),h.IndentNo) IndentNo,COALESCE(d.DeptName,CONVERT(varchar(255),h.DeptCode)) Department,h.Approval,h.Remarks FROM dbo.StoreIssHead h LEFT JOIN dbo.DepartmentMaster d ON d.Code=h.DeptCode`],
 ['item_issue_details', `SELECT d.IssueNo,d.ItemCode,i.ItemName,d.ActUnitRate UnitRate,d.IssueValue TotalAmount,d.Qty,i.UOM,d.Remark EmpName FROM dbo.StoreIssDetail d JOIN dbo.ItemMas i ON i.ItemCode=d.ItemCode`]
];
async function main() {
 const c=await mysql.createConnection({host:'127.0.0.1',user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:stage});
 try {
  for(const [table] of imports) {const [r]=await c.query('SELECT COUNT(*) n FROM ??',[table]); if(r[0].n) throw new Error(`${table} already contains data; do not rerun`);}
  const data=imports.map(([table,query])=>[table,source(query)]);
  await c.beginTransaction();
  try {
   for(const [table,rows] of data) {
    for(const row of rows) {row.createdAt=new Date();row.updatedAt=row.createdAt;await c.query('INSERT INTO ?? SET ?', [table,row]);}
    console.log(`${table}: ${rows.length}`);
   }
   await c.commit();
  } catch(e) {await c.rollback(); throw e;}
 } finally {await c.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
