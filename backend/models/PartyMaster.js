const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PartyMaster = sequelize.define('PartyMaster', {
    Code: {
        type: DataTypes.STRING(100),
        primaryKey: true,
        allowNull: false,
        unique: true
    },
    AccountName: {
        type: DataTypes.STRING(255),
        allowNull: false
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
    TINNo: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    CSTNo: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    PhNo: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    Email: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    Fax: {
        type: DataTypes.STRING(20),
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
    CellNo: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    ECCode: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    Range: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    Division: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    GSTNo: {
        type: DataTypes.STRING(50),
        allowNull: true
    }
}, {
    tableName: 'party_masters',
    timestamps: true
});

module.exports = PartyMaster;