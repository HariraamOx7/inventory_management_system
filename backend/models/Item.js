const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Item = sequelize.define('Item', {
    ItemCode: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    ItemName: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    UnitRate: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    MinStockLevel: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    OpeningQty: {
        type: DataTypes.DECIMAL(20, 2),
        defaultValue: 0
    },
    Quantity: {
        type: DataTypes.DECIMAL(20, 2),
        defaultValue: 0
    },
    MaxStockLevel: {
        type: DataTypes.DECIMAL(20, 2),
        defaultValue: 0
    },
    OpenValue: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    Location: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    DepartmentId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    HSNCode: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    SubHeadCode: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    UOM: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    Category: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    Commodity: {
        type: DataTypes.STRING(100),
        allowNull: true
    }
}, {
    tableName: 'items',
    timestamps: true
});

module.exports = Item;