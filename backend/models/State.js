const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const State = sequelize.define('State', {
    StateCode: {
        type: DataTypes.STRING(10),
        primaryKey: true,
        allowNull: false,
        unique: true
    },
    StateName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    }
}, {
    tableName: 'states',
    timestamps: true
});

module.exports = State;