// backend/models/GatePassOutDetail.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class GatePassOutDetail extends Model {}

GatePassOutDetail.init({
  DetailId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  GpNo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ItemName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  Qty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  Reason: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'GatePassOutDetail',
  tableName: 'gate_pass_out_details',
  timestamps: true
});

module.exports = GatePassOutDetail;