// backend/models/ReceiptDetail.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class ReceiptDetail extends Model { }

ReceiptDetail.init({
  DetailId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  GRNNo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  OrderNo: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  ItemCode: {
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
  StockUnitRate: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true
  },
  StockValue: {
    type: DataTypes.DECIMAL(20, 6),
    allowNull: true
  },
  SourceKey: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true
  }
}, {
  sequelize,
  modelName: 'ReceiptDetail',
  tableName: 'receipt_details',
  timestamps: true
});

module.exports = ReceiptDetail;
