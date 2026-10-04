// backend/models/index.js
const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');

// Import all models
const Department = require('./Department');
const SubHead = require('./SubHead');
const Item = require('./Item');
const Supplier = require('./Supplier');
const ItemMaster = require('./ItemMaster');
const PartyMaster = require('./PartyMaster');
const PurchaseType = require('./PurchaseType');
const State = require('./State');
const StoreMaster = require('./StoreMaster');
const ProductHead = require('./ProductHead');
const UOM = require('./UOM');
const PurchaseOrder = require('./PurchaseOrder');
const PurchaseOrderDetail = require('./PurchaseOrderDetail');
const GateInward = require('./GateInward');
const GateInwardDetail = require('./GateInwardDetail');
const Receipt = require('./Receipt');
const ReceiptDetail = require('./ReceiptDetail');
const BillEntry = require('./BillEntry');
const BillEntryDetail = require('./BillEntryDetail');
const ItemIssue = require('./ItemIssue');
const ItemIssueDetail = require('./ItemIssueDetail');
const GatePassOut = require('./GatePassOut');
const GatePassOutDetail = require('./GatePassOutDetail');
const GatePassIn = require('./GatePassIn');
const GatePassInDetail = require('./GatePassInDetail');
const CancelOrder = require('./CancelOrder');
const BillVerify = require('./BillVerify');
const User = require('./User');
// Define associations (only those not already defined in model files)

// PurchaseOrder associations
PurchaseOrder.hasMany(PurchaseOrderDetail, { 
  foreignKey: 'OrderNo', 
  as: 'details',
  onDelete: 'CASCADE'
});
PurchaseOrderDetail.belongsTo(PurchaseOrder, { 
  foreignKey: 'OrderNo',
  as: 'order'
});

// GateInward associations
GateInward.hasMany(GateInwardDetail, { 
  foreignKey: 'InwardNo', 
  as: 'details',
  onDelete: 'CASCADE'
});
GateInwardDetail.belongsTo(GateInward, { 
  foreignKey: 'InwardNo',
  as: 'inward'
});

Receipt.hasMany(ReceiptDetail, { 
  foreignKey: 'GRNNo', 
  as: 'details',
  onDelete: 'CASCADE'
});
ReceiptDetail.belongsTo(Receipt, { 
  foreignKey: 'GRNNo',
  as: 'receipt'
});
BillEntry.hasMany(BillEntryDetail, { 
  foreignKey: 'VoucherNo', 
  as: 'details',
  onDelete: 'CASCADE'
});
BillEntryDetail.belongsTo(BillEntry, { 
  foreignKey: 'VoucherNo',
  as: 'billEntry'
});
ItemIssue.hasMany(ItemIssueDetail, { 
  foreignKey: 'IssueNo', 
  as: 'details',
  onDelete: 'CASCADE'
});
ItemIssueDetail.belongsTo(ItemIssue, { 
  foreignKey: 'IssueNo',
  as: 'issue'
});
GatePassOut.hasMany(GatePassOutDetail, { 
  foreignKey: 'GpNo', 
  as: 'details',
  onDelete: 'CASCADE'
});
GatePassOutDetail.belongsTo(GatePassOut, { 
  foreignKey: 'GpNo',
  as: 'gatePassOut'
});
GatePassIn.hasMany(GatePassInDetail, { 
  foreignKey: 'InNo', 
  as: 'details',
  onDelete: 'CASCADE'
});
GatePassInDetail.belongsTo(GatePassIn, { 
  foreignKey: 'InNo',
  as: 'gatePassIn'
});
// SubHead and Department associations
SubHead.belongsTo(Department, {
    foreignKey: 'department_id',
    as: 'department',
    onDelete: 'SET NULL'
});

// Supplier associations
PurchaseOrder.belongsTo(Supplier, { foreignKey: 'PartyCode', targetKey: 'PartyCode', as: 'supplier', constraints: false });
Supplier.hasMany(PurchaseOrder, { foreignKey: 'PartyCode', sourceKey: 'PartyCode', as: 'purchaseOrders', constraints: false });

GateInward.belongsTo(Supplier, { foreignKey: 'PartyCode', targetKey: 'PartyCode', as: 'supplier', constraints: false });
Supplier.hasMany(GateInward, { foreignKey: 'PartyCode', sourceKey: 'PartyCode', as: 'gateInwards', constraints: false });

Receipt.belongsTo(Supplier, { foreignKey: 'PartyCode', targetKey: 'PartyCode', as: 'supplier', constraints: false });
Supplier.hasMany(Receipt, { foreignKey: 'PartyCode', sourceKey: 'PartyCode', as: 'receipts', constraints: false });

BillEntry.belongsTo(Supplier, { foreignKey: 'PartyCode', targetKey: 'PartyCode', as: 'supplier', constraints: false });
Supplier.hasMany(BillEntry, { foreignKey: 'PartyCode', sourceKey: 'PartyCode', as: 'billEntries', constraints: false });

// Item associations
PurchaseOrderDetail.belongsTo(Item, { foreignKey: 'ItemCode', targetKey: 'ItemCode', as: 'item', constraints: false });
Item.hasMany(PurchaseOrderDetail, { foreignKey: 'ItemCode', sourceKey: 'ItemCode', as: 'poDetails', constraints: false });

GateInwardDetail.belongsTo(Item, { foreignKey: 'ItemCode', targetKey: 'ItemCode', as: 'item', constraints: false });
Item.hasMany(GateInwardDetail, { foreignKey: 'ItemCode', sourceKey: 'ItemCode', as: 'gateInwardDetails', constraints: false });

ReceiptDetail.belongsTo(Item, { foreignKey: 'ItemCode', targetKey: 'ItemCode', as: 'item', constraints: false });
Item.hasMany(ReceiptDetail, { foreignKey: 'ItemCode', sourceKey: 'ItemCode', as: 'receiptDetails', constraints: false });

BillEntryDetail.belongsTo(Item, { foreignKey: 'ItemCode', targetKey: 'ItemCode', as: 'item', constraints: false });
Item.hasMany(BillEntryDetail, { foreignKey: 'ItemCode', sourceKey: 'ItemCode', as: 'billEntryDetails', constraints: false });

// PurchaseType associations
BillEntry.belongsTo(PurchaseType, { foreignKey: 'PurchaseType', targetKey: 'Code', as: 'purchaseTypeMaster', constraints: false });
PurchaseType.hasMany(BillEntry, { foreignKey: 'PurchaseType', sourceKey: 'Code', as: 'billEntries', constraints: false });



module.exports = {
  sequelize,
  Department,
  SubHead,
  Item,
  Supplier,
  ItemMaster,
  PartyMaster,
  PurchaseType,
  State,
  StoreMaster,
  ProductHead,
  UOM,
  PurchaseOrder,
  PurchaseOrderDetail,
  GateInward,
  GateInwardDetail,
  Receipt,
  ReceiptDetail,
  BillEntry,
  BillEntryDetail,
  ItemIssue,
  ItemIssueDetail,
  GatePassOut,
  GatePassOutDetail,
  GatePassIn,
  GatePassInDetail,
  CancelOrder,
  BillVerify,
  User
};