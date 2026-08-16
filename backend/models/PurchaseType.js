const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class PurchaseType extends Model { }

PurchaseType.init({
  Code: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  PurchaseType: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  Description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  AssessValue: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  RoundOff: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  Duty1: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  Commodity: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  TDS: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  LorryFreight: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  SGST: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  SGSTLedger: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  CGST: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  CGSTLedger: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  IGST: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  IGSTLedger: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  TCS: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  TCSLedger: {
    type: DataTypes.STRING(100),
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'PurchaseType',
  tableName: 'purchase_types',
  timestamps: true
});

module.exports = PurchaseType;