// backend/models/BillVerify.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class BillVerify extends Model {}

BillVerify.init({
  VerifyNo: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  VoucherNo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  BillNo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  BillDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  PartyName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  BillAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  GSTAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  IGSTAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  VerifyDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  PaymentStatus: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'Unpaid'
  },
  Remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'BillVerify',
  tableName: 'bill_verify',
  timestamps: true
});

module.exports = BillVerify;