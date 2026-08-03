// backend/models/GatePassOut.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class GatePassOut extends Model {}

GatePassOut.init({
  GpNo: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  PartyName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  Address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  Department: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  GpDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  DespatchThrough: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  Returnable: {
    type: DataTypes.ENUM('Yes', 'No'),
    defaultValue: 'No'
  },
  Remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  GpRefNo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  Status: {
    type: DataTypes.STRING(50),
    defaultValue: 'Draft'
  }
}, {
  sequelize,
  modelName: 'GatePassOut',
  tableName: 'gate_pass_outs',
  timestamps: true
});

module.exports = GatePassOut;