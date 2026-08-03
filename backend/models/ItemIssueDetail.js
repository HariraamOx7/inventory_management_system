// backend/models/ItemIssueDetail.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class ItemIssueDetail extends Model {}

ItemIssueDetail.init({
  DetailId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  IssueNo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ItemName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  CatNo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  DrawNo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  Qty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  OpeningQty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  UOM: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  EmpName: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'ItemIssueDetail',
  tableName: 'item_issue_details',
  timestamps: true
});

module.exports = ItemIssueDetail;