// backend/models/GateInwardDetail.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class GateInwardDetail extends Model {}

GateInwardDetail.init({
  DetailId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  InwardNo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  OrderNo: {
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
  ReceivedQty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  }
}, {
  sequelize,
  modelName: 'GateInwardDetail',
  tableName: 'gate_inward_details',
  timestamps: true
});

module.exports = GateInwardDetail;