const StoreMaster = require('../models/StoreMaster');

exports.getStores = async (req, res) => {
    try {
        const stores = await StoreMaster.findAll({
            order: [['StoreCode', 'ASC']]
        });
        res.json({
            success: true,
            data: stores
        });
    } catch (error) {
        console.error('Error fetching stores:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching stores',
            error: error.message 
        });
    }
};

exports.addStore = async (req, res) => {
    try {
        const { StoreCode, StoreName } = req.body;
        
        if (!StoreCode || !StoreName) {
            return res.status(400).json({
                success: false,
                message: 'Store Code and Store Name are required'
            });
        }
        
        const newStore = await StoreMaster.create({ 
            StoreCode: StoreCode.trim(),
            StoreName: StoreName.trim()
        });
        
        res.status(201).json({
            success: true,
            data: newStore
        });
    } catch (error) {
        console.error('Error adding store:', error);
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                success: false,
                message: 'Store with this code or name already exists',
                error: error.message
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error adding store',
            error: error.message 
        });
    }
};

exports.updateStore = async (req, res) => {
    try {
        const { code } = req.params;
        const { StoreName } = req.body;

        if (!StoreName || StoreName.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Store Name is required'
            });
        }

        const store = await StoreMaster.findByPk(code);
        if (!store) {
            return res.status(404).json({
                success: false,
                message: 'Store not found'
            });
        }

        await store.update({ 
            StoreName: StoreName.trim()
        });

        res.json({
            success: true,
            data: store
        });
    } catch (error) {
        console.error('Error updating store:', error);
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                success: false,
                message: 'Store with this name already exists',
                error: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Error updating store',
            error: error.message
        });
    }
};

exports.deleteStore = async (req, res) => {
    try {
        const { code } = req.params;
        
        const store = await StoreMaster.findByPk(code);
        if (!store) {
            return res.status(404).json({
                success: false,
                message: 'Store not found'
            });
        }

        await store.destroy();

        res.json({
            success: true,
            message: 'Store deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting store:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting store',
            error: error.message
        });
    }
};