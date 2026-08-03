const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class ProductHead extends Model {}

ProductHead.init({
  ProdHeadCode: {
    type: DataTypes.STRING(100),
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  ProdHeadDesc: {
    type: DataTypes.STRING(255),
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'ProductHead',
  tableName: 'productheads',
  timestamps: true
});

module.exports = ProductHead;