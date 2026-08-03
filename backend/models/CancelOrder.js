// backend/models/CancelOrder.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class CancelOrder extends Model {}

CancelOrder.init({
  CancelNo: {
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
  CancelDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  Reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  Status: {
    type: DataTypes.STRING(50),
    defaultValue: 'Active'
  }
}, {
  sequelize,
  modelName: 'CancelOrder',
  tableName: 'cancel_orders',
  timestamps: true
});

module.exports = CancelOrder;