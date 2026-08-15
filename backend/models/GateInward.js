// backend/models/GateInward.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class GateInward extends Model {}

GateInward.init({
  InwardNo: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  OrderNo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  PartyName: {
    type: DataTypes.STRING(255),
    allowNull: false
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
  Status: {
    type: DataTypes.STRING(50),
    defaultValue: 'Draft'
  }
}, {
  sequelize,
  modelName: 'GateInward',
  tableName: 'gate_inwards',
  timestamps: true
});

module.exports = GateInward;