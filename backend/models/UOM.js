const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const UOM = sequelize.define('UOM', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    uom: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'uoms',
    timestamps: true
});

module.exports = UOM;