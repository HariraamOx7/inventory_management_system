const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SubHead = sequelize.define('SubHead', {
    code: {
        type: DataTypes.STRING(100),
        primaryKey: true,
        allowNull: false,
        unique: true
    },
    sub_group_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    department_id: {
        type: DataTypes.INTEGER,
        allowNull: true,  // Changed from false to true
        references: {
            model: 'departments',
            key: 'dept_id'
        }
    }
}, {
    tableName: 'sub_heads',
    timestamps: true
});

module.exports = SubHead;
