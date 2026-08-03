// backend/models/GatePassIn.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class GatePassIn extends Model {}

GatePassIn.init({
  InNo: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  PartyName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  GiDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  DcNo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  DcDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  InvoiceNo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  InvoiceDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  LrcNo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  Status: {
    type: DataTypes.STRING(50),
    defaultValue: 'Draft'
  }
}, {
  sequelize,
  modelName: 'GatePassIn',
  tableName: 'gate_pass_ins',
  timestamps: true
});

module.exports = GatePassIn;