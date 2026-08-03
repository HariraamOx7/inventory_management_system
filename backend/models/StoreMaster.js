const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class StoreMaster extends Model {}

StoreMaster.init({
  StoreCode: {
    type: DataTypes.STRING(50),
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  StoreName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  }
}, {
  sequelize,
  modelName: 'StoreMaster',
  tableName: 'storemasters',
  timestamps: true
});

module.exports = StoreMaster;