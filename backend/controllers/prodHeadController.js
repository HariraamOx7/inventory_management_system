const ProductHead = require('../models/ProductHead');

exports.getProductHeads = async (req, res) => {
    try {
        const productHeads = await ProductHead.findAll({
            order: [['ProdHeadCode', 'ASC']]
        });
        res.json({
            success: true,
            data: productHeads
        });
    } catch (error) {
        console.error('Error fetching product heads:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching product heads',
            error: error.message 
        });
    }
};

exports.addProductHead = async (req, res) => {
    try {
        const { ProdHeadCode, ProdHeadDesc } = req.body;
        
        if (!ProdHeadCode || !ProdHeadDesc) {
            return res.status(400).json({
                success: false,
                message: 'Product head code and description are required'
            });
        }
        
        const newProductHead = await ProductHead.create({ 
            ProdHeadCode: ProdHeadCode.trim(),
            ProdHeadDesc: ProdHeadDesc.trim()
        });
        
        res.status(201).json({
            success: true,
            data: newProductHead
        });
    } catch (error) {
        console.error('Error adding product head:', error);
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                success: false,
                message: 'Product head with this code already exists',
                error: error.message
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error adding product head',
            error: error.message 
        });
    }
};

exports.updateProductHead = async (req, res) => {
    try {
        const { code } = req.params;
        const { ProdHeadDesc } = req.body;

        if (!ProdHeadDesc || ProdHeadDesc.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Product head description is required'
            });
        }

        const productHead = await ProductHead.findByPk(code);
        if (!productHead) {
            return res.status(404).json({
                success: false,
                message: 'Product head not found'
            });
        }

        await productHead.update({ 
            ProdHeadDesc: ProdHeadDesc.trim()
        });

        res.json({
            success: true,
            data: productHead
        });
    } catch (error) {
        console.error('Error updating product head:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating product head',
            error: error.message
        });
    }
};

exports.deleteProductHead = async (req, res) => {
    try {
        const { code } = req.params;
        
        const productHead = await ProductHead.findByPk(code);
        if (!productHead) {
            return res.status(404).json({
                success: false,
                message: 'Product head not found'
            });
        }

        await productHead.destroy();

        res.json({
            success: true,
            message: 'Product head deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting product head:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting product head',
            error: error.message
        });
    }
};