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
  }
}, {
  sequelize,
  modelName: 'ReceiptDetail',
  tableName: 'receipt_details',
  timestamps: true
});

module.exports = ReceiptDetail;
