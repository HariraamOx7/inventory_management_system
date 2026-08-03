// backend/models/GatePassInDetail.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class GatePassInDetail extends Model {}

GatePassInDetail.init({
  DetailId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  InNo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ItemName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  PendingQty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  RecQty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  GpNo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  Reason: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'GatePassInDetail',
  tableName: 'gate_pass_in_details',
  timestamps: true
});

module.exports = GatePassInDetail;