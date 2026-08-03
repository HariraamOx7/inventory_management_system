const { literal } = require('sequelize');
const SubHead = require('../models/SubHead');
const Department = require('../models/Department');

exports.getLastCode = async (req, res) => {
    try {
        const lastSubHead = await SubHead.findOne({
            order: [[literal('CAST(code AS SIGNED)'), 'DESC']]
        });
        
        res.json({
            success: true,
            data: { lastCode: lastSubHead ? lastSubHead.code : 0 }
        });
    } catch (error) {
        console.error('Error fetching last code:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching last code',
            error: error.message
        });
    }
};

exports.getSubHeads = async (req, res) => {
    try {
        const subHeads = await SubHead.findAll({
            include: [{
                model: Department,
                as: 'department',
                attributes: ['dept_id', 'dept_name']
            }],
            order: [[literal('CAST(code AS SIGNED)'), 'ASC']]
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

exports.getSubHeadsByDepartment = async (req, res) => {
    try {
        const { deptId } = req.query;
        
        if (!deptId) {
            return res.status(400).json({
                success: false,
                message: 'Department ID is required'
            });
        }

        const subHeads = await SubHead.findAll({
            where: { department_id: deptId },
            order: [['sub_group_name', 'ASC']]
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

exports.addSubHead = async (req, res) => {
    try {
        const { sub_group_name, department_id } = req.body;
        
        if (!sub_group_name || !department_id) {
            return res.status(400).json({
                success: false,
                message: 'Sub group name and department are required'
            });
        }

        const department = await Department.findByPk(department_id);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        // Generate code - Fixed with numeric sorting
        const lastSubHead = await SubHead.findOne({
            order: [[literal('CAST(code AS SIGNED)'), 'DESC']]
        });
        const newCode = (lastSubHead ? parseInt(lastSubHead.code) + 1 : 1).toString();
        
        const newSubHead = await SubHead.create({ 
            code: newCode,
            sub_group_name: sub_group_name.trim(),
            department_id: department_id
        });

        res.status(201).json({
            success: true,
            message: 'Sub Head created successfully',
            data: newSubHead
        });
    } catch (error) {
        console.error('Error adding sub head:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding sub head',
            error: error.message
        });
    }
};


exports.updateSubHead = async (req, res) => {
    try {
        const { code } = req.params;
        const { sub_group_name, department_id } = req.body;

        if (!sub_group_name || sub_group_name.trim() === '' || !department_id) {
            return res.status(400).json({
                success: false,
                message: 'Sub group name and department are required'
            });
        }

        const subHead = await SubHead.findByPk(code);
        if (!subHead) {
            return res.status(404).json({
                success: false,
                message: 'Sub head not found'
            });
        }

        // Check if department exists
        const department = await Department.findByPk(department_id);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        await subHead.update({ 
            sub_group_name: sub_group_name.trim(),
            department_id: department_id
        });

        res.json({
            success: true,
            data: subHead
        });
    } catch (error) {
        console.error('Error updating sub head:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating sub head',
            error: error.message
        });
    }
};

exports.deleteSubHead = async (req, res) => {
    try {
        const { code } = req.params;
        
        const subHead = await SubHead.findByPk(code);
        if (!subHead) {
            return res.status(404).json({
                success: false,
                message: 'Sub head not found'
            });
        }

        await subHead.destroy();

        res.json({
            success: true,
            message: 'Sub head deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting sub head:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting sub head',
            error: error.message
        });
    }
};

