const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class Supplier extends Model {}

Supplier.init({
  AccCode: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  Description: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  AccountName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  Place: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  Address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  DeliveryAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  OpeningCredit: {
    type: DataTypes.DECIMAL(20, 2),
    defaultValue: 0
  },
  OpeningDebit: {
    type: DataTypes.DECIMAL(20, 2),
    defaultValue: 0
  },
  TINNo: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  CSTNo: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  PhNo: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  Fax: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  CellNo: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  Email: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  WebSite: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  AccountNo: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  ContactPerson: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  Pincode: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  PanNumber: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  Department: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  GSTNo: {
    type: DataTypes.STRING(50),
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'Supplier',
  tableName: 'suppliers',
  timestamps: true
});

module.exports = Supplier;