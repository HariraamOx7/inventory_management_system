// backend/models/Receipt.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class Receipt extends Model {}

Receipt.init({
  GRNNo: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  PartyName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  GateInwardNo: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  InwardDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  InvoiceNo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  InvoiceDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  DCNo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  DCDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  FormType: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  BillAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
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
  modelName: 'Receipt',
  tableName: 'receipts',
  timestamps: true
});

module.exports = Receipt;