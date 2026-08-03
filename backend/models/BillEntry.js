const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class BillEntry extends Model {}

BillEntry.init({
  VoucherNo: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  GateInwardNo: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  GRNNo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  OrderNo: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  PartyName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  AccDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  PartyBillNo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  BillDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  PurchaseType: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  BillAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  TDS: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  Narration: {
    type: DataTypes.TEXT,
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
  TaxRndOff: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  GrandTotal: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  TCS: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  VatWithPF: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  VoltasFormat: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  DutyWithoutPF: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  Status: {
    type: DataTypes.STRING(50),
    defaultValue: 'Draft'
  }
}, {
  sequelize,
  modelName: 'BillEntry',
  tableName: 'bill_entries',
  timestamps: true
});

module.exports = BillEntry;