const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ItemMaster = sequelize.define('ItemMaster', {
    ItemCode: {
        type: DataTypes.STRING(50),
        primaryKey: true,
        allowNull: false,
        unique: true
    },
    ItemName: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    UnitRate: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    Department: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    UOM: {
        type: DataTypes.STRING(50),
        allowNull: true
    }
}, {
    tableName: 'item_masters',
    timestamps: true
});

module.exports = ItemMaster;