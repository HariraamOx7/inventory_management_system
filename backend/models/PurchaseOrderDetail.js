// backend/models/PurchaseOrderDetail.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class PurchaseOrderDetail extends Model { }

PurchaseOrderDetail.init({
  DetailId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  OrderNo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ItemName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  Qty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  UnitRate: {
    type: DataTypes.DECIMAL(15, 6),
    defaultValue: 0
  },
  TotalAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  DiscountPct: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0
  },
  DiscountAmt: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  GSTType: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  GSTPct: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0
  },
  SGSTPct: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0
  },
  SGST: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  CGSTPct: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0
  },
  CGST: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  IGSTPct: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0
  },
  IGST: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  TaxType: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  TaxPct: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0
  },
  TaxAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  PF_Pct: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0
  },
  PF_Amount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  LorryFreight: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  RoundOff: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  GrandTotal: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  MRS_No: {
    type: DataTypes.STRING(100),
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'PurchaseOrderDetail',
  tableName: 'purchase_order_details',
  timestamps: true
});

module.exports = PurchaseOrderDetail;
