// Master rows and upstream documents must remain available to their dependants.
module.exports = async function preventReferencedDeletion(modelName, row, transaction) {
  const m = require('../models');
  const { Op } = require('sequelize');
  const references = {
    Item: [
      ['PurchaseOrderDetail', { ItemCode: row.ItemCode }], ['GateInwardDetail', { ItemCode: row.ItemCode }],
      ['ReceiptDetail', { ItemCode: row.ItemCode }], ['BillEntryDetail', { ItemCode: row.ItemCode }],
      ['ItemIssueDetail', { ItemCode: row.ItemCode }]
    ],
    Supplier: ['PurchaseOrder', 'GateInward', 'Receipt', 'BillEntry'].map(name => [name, { PartyCode: row.PartyCode }]),
    Department: [['Item', { DepartmentId: row.dept_id }], ['SubHead', { department_id: row.dept_id }], ['ItemIssue', { Department: row.dept_name }]],
    SubHead: [['Item', { SubHeadCode: row.code }]],
    Receipt: [['BillEntry', { GRNNo: row.GRNNo }]],
    GateInward: [['Receipt', { GateInwardNo: row.InwardNo }], ['BillEntry', { GateInwardNo: row.InwardNo }]],
    GatePassOut: [['GatePassInDetail', { GpNo: String(row.GpNo) }]],
    BillEntry: [['BillVerify', { VoucherNo: row.VoucherNo }]],
    PurchaseType: [['BillEntry', { PurchaseType: { [Op.in]: [String(row.Code), row.PurchaseType] } }]],
    UOM: [['Item', { UOM: row.uom }], ['ItemMaster', { UOM: row.uom }]],
    ItemMaster: [['GatePassOutDetail', { ItemName: row.ItemName }], ['GatePassInDetail', { ItemName: row.ItemName }]],
    PartyMaster: [['GatePassOut', { PartyName: row.AccountName }], ['GatePassIn', { PartyName: row.AccountName }]]
  };
  for (const [name, where] of references[modelName] || []) {
    if (await m[name].findOne({ where, attributes: [m[name].primaryKeyAttribute], raw: true, transaction })) {
      const error = new Error(`Cannot delete ${modelName}: it is used by ${name}. Remove or correct the linked transaction first.`);
      error.statusCode = 409;
      throw error;
    }
  }
};
