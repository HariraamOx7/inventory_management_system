const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const SubHead = require('./SubHead');

class Department extends Model {}

Department.init({
  dept_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  dept_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: 'departments_dept_name_unique'
  }
}, {
  sequelize,
  modelName: 'Department',
  tableName: 'departments',
  timestamps: true // This will add createdAt and updatedAt fields
});

Department.hasMany(SubHead, {
  foreignKey: 'department_id',
  as: 'subHeads',
  onDelete: 'SET NULL'
});

module.exports = Department;
