const ItemMaster = require('../models/ItemMaster');
const Department = require('../models/Department');
const UOM = require('../models/UOM');


const SubHead = require('../models/SubHead');

// Generate ItemCode based on Department ID, SubHead Code, Department abbreviation, and auto-increment
exports.generateItemCode = async (req, res) => {
    try {
        const { departmentId, subHeadCode, departmentName } = req.body;

        if (!departmentId || !subHeadCode || !departmentName) {
            return res.status(400).json({
                success: false,
                message: 'Department ID, Sub Head Code, and Department Name are required'
            });
        }

        // Get abbreviation from department name (first 2-3 letters)
        const abbr = departmentName
            .trim()
            .toLowerCase()
            .split(' ')
            .map(word => word[0])
            .join('')
            .substring(0, 3);

        // Get the count of items with this prefix to generate 4-digit number
        const itemsWithPrefix = await ItemMaster.findAll({
            where: {
                ItemCode: {
                    [require('sequelize').Op.startsWith]: `${departmentId}/${subHeadCode}/${abbr}/`
                }
            },
            order: [['ItemCode', 'DESC']]
        });

        const nextNumber = itemsWithPrefix.length + 1;
        const paddedNumber = String(nextNumber).padStart(4, '0');
        const generatedCode = `${departmentId}/${subHeadCode}/${abbr}/${paddedNumber}`;

        res.json({
            success: true,
            data: { itemCode: generatedCode }
        });
    } catch (error) {
        console.error('Error generating item code:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating item code',
            error: error.message
        });
    }
};

// Get SubHeads by Department
exports.getSubHeadsByDepartment = async (req, res) => {
    try {
        const { departmentId } = req.query;

        if (!departmentId) {
            return res.status(400).json({
                success: false,
                message: 'Department ID is required'
            });
        }

        const subHeads = await SubHead.findAll({
            where: { department_id: departmentId },
            order: [['code', 'ASC']]
        });

        res.json({
            success: true,
            data: subHeads
        });
    } catch (error) {
        console.error('Error fetching sub heads:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching sub heads',
            error: error.message
        });
    }
};

exports.getItemMasters = async (req, res) => {
    try {
        const itemMasters = await ItemMaster.findAll({
            order: [['ItemCode', 'ASC']]
        });
        res.json({
            success: true,
            data: itemMasters
        });
    } catch (error) {
        console.error('Error fetching item masters:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching item masters',
            error: error.message 
        });
    }
};

exports.getDepartments = async (req, res) => {
    try {
        const departments = await Department.findAll({
            attributes: ['dept_id', 'dept_name'],
            order: [['dept_name', 'ASC']]
        });
        res.json({
            success: true,
            data: departments
        });
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching departments',
            error: error.message 
        });
    }
};

exports.getUOMs = async (req, res) => {
    try {
        const uoms = await UOM.findAll({
            attributes: ['id', 'uom'],
            order: [['uom', 'ASC']]
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

exports.addItemMaster = async (req, res) => {
    try {
        const { ItemCode, ItemName, UnitRate, Department, UOM } = req.body;
        
        if (!ItemCode || !ItemName) {
            return res.status(400).json({
                success: false,
                message: 'Item Code and Item Name are required'
            });
        }
        
        const newItemMaster = await ItemMaster.create({ 
            ItemCode: ItemCode.trim(),
            ItemName: ItemName.trim(),
            UnitRate: UnitRate || 0,
            Department: Department ? Department.trim() : null,
            UOM: UOM ? UOM.trim() : null
        });
        
        res.status(201).json({
            success: true,
            data: newItemMaster
        });
    } catch (error) {
        console.error('Error adding item master:', error);
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                success: false,
                message: 'Item with this Code already exists',
                error: error.message
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error adding item master',
            error: error.message 
        });
    }
};

exports.updateItemMaster = async (req, res) => {
    try {
        const { code } = req.params;
        const { ItemName, UnitRate, Department, UOM } = req.body;

        if (!ItemName || ItemName.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Item Name is required'
            });
        }

        const itemMaster = await ItemMaster.findByPk(code);
        if (!itemMaster) {
            return res.status(404).json({
                success: false,
                message: 'Item master not found'
            });
        }

        await itemMaster.update({ 
            ItemName: ItemName.trim(),
            UnitRate: UnitRate || 0,
            Department: Department ? Department.trim() : null,
            UOM: UOM ? UOM.trim() : null
        });

        res.json({
            success: true,
            data: itemMaster
        });
    } catch (error) {
        console.error('Error updating item master:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating item master',
            error: error.message
        });
    }
};

exports.deleteItemMaster = async (req, res) => {
    try {
        const { code } = req.params;
        
        const itemMaster = await ItemMaster.findByPk(code);
        if (!itemMaster) {
            return res.status(404).json({
                success: false,
                message: 'Item master not found'
            });
        }

        await itemMaster.destroy();

        res.json({
            success: true,
            message: 'Item master deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting item master:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting item master',
            error: error.message
        });
    }
};