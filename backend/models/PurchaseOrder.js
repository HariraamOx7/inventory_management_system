// backend/models/PurchaseOrder.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class PurchaseOrder extends Model {}

PurchaseOrder.init({
  OrderNo: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  OrderDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  PartyName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  Address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  Place: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  Remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  RefNo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  Total: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  Discount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  GST: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  IGST: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  VAT_CST: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  P_F: {
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
  DutyWithoutPF: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  VoltasFormat: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  VatWithPF: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  Status: {
    type: DataTypes.STRING(50),
    defaultValue: 'Draft'
  }
}, {
  sequelize,
  modelName: 'PurchaseOrder',
  tableName: 'purchase_orders',
  timestamps: true
});

module.exports = PurchaseOrder;