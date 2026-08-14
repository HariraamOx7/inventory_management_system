// backend/models/BillEntryDetail.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class BillEntryDetail extends Model { }

BillEntryDetail.init({
  DetailId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  VoucherNo: {
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
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  TotalAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  }
}, {
  sequelize,
  modelName: 'BillEntryDetail',
  tableName: 'bill_entry_details',
  timestamps: true
});

module.exports = BillEntryDetail;