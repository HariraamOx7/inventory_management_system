const UOM = require('../models/UOM');

exports.getUoms = async (req, res) => {
    try {
        const uoms = await UOM.findAll({
            order: [['id', 'ASC']]
        });
        res.json({
            success: true,
            data: uoms
        });
    } catch (error) {
        console.error('Error fetching UOMs:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching UOMs',
            error: error.message 
        });
    }
};

exports.addUom = async (req, res) => {
    try {
        const { uom } = req.body;
        
        if (!uom) {
            return res.status(400).json({
                success: false,
                message: 'UOM is required'
            });
        }
        
        const newUom = await UOM.create({ 
            uom: uom.trim()
        });
        
        res.status(201).json({
            success: true,
            data: newUom
        });
    } catch (error) {
        console.error('Error adding UOM:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error adding UOM',
            error: error.message 
        });
    }
};

exports.updateUom = async (req, res) => {
    try {
        const { id } = req.params;
        const { uom } = req.body;

        if (!uom || uom.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'UOM is required'
            });
        }

        const uomRecord = await UOM.findByPk(id);
        if (!uomRecord) {
            return res.status(404).json({
                success: false,
                message: 'UOM not found'
            });
        }

        await uomRecord.update({ 
            uom: uom.trim()
        });

        res.json({
            success: true,
            data: uomRecord
        });
    } catch (error) {
        console.error('Error updating UOM:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating UOM',
            error: error.message
        });
    }
};

exports.deleteUom = async (req, res) => {
    try {
        const { id } = req.params;
        
        const uom = await UOM.findByPk(id);
        if (!uom) {
            return res.status(404).json({
                success: false,
                message: 'UOM not found'
            });
        }

        await uom.destroy();

        res.json({
            success: true,
            message: 'UOM deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting UOM:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting UOM',
            error: error.message
        });
    }
};