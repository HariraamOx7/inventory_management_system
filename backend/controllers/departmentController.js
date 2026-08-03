const Department = require('../models/Department');

exports.getDepartments = async (req, res) => {
  try {
    const departments = await Department.findAll({
      order: [['dept_id', 'ASC']]
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

exports.addDepartment = async (req, res) => {
  try {
    const { dept_name } = req.body;
    if (!dept_name) {
      return res.status(400).json({
        success: false,
        message: 'Department name is required'
      });
    }
    
    const newDepartment = await Department.create({ dept_name });
    res.status(201).json({
      success: true,
      data: newDepartment
    });
  } catch (error) {
    console.error('Error adding department:', error);
    
    res.status(500).json({ 
      success: false, 
      message: 'Duplicate department name or error adding department',
      error: error.message 
    });
  }
};

exports.updateDepartment = async (req, res) => {
    try {
        const { dept_id } = req.params;
        const { dept_name } = req.body;

        if (!dept_name || dept_name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Department name is required'
            });
        }

        const department = await Department.findByPk(dept_id);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        await department.update({ dept_name: dept_name.trim() });

        res.json({
            success: true,
            data: department
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating department',
            error: error.message
        });
    }
};

exports.deleteDepartment = async (req, res) => {
    try {
        const { dept_id } = req.params;
        
        const department = await Department.findByPk(dept_id);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        await department.destroy();

        res.json({
            success: true,
            message: 'Department deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting department',
            error: error.message
        });
    }
};