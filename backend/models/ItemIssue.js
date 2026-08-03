// backend/models/ItemIssue.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class ItemIssue extends Model {}

ItemIssue.init({
  IssueNo: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  IssueDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  IndentNo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  Department: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  Approval: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  Remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  Status: {
    type: DataTypes.STRING(50),
    defaultValue: 'Draft'
  }
}, {
  sequelize,
  modelName: 'ItemIssue',
  tableName: 'item_issues',
  timestamps: true
});

module.exports = ItemIssue;