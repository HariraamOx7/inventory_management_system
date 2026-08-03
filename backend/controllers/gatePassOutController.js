// backend/controllers/gatePassOutController.js
const GatePassOut = require('../models/GatePassOut');
const GatePassOutDetail = require('../models/GatePassOutDetail');
const Supplier = require('../models/Supplier');
const Department = require('../models/Department');
const ItemMaster = require('../models/ItemMaster');

// Get last GP number
exports.getLastGpNo = async (req, res) => {
  try {
    const lastGp = await GatePassOut.findOne({
      order: [['GpNo', 'DESC']]
    });
    
    res.json({
      success: true,
      data: { lastGpNo: lastGp ? lastGp.GpNo : 0 }
    });
  } catch (error) {
    console.error('Error fetching last GP number:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching GP number',
      error: error.message
    });
  }
};

// Get all parties (suppliers) for dropdown
exports.getParties = async (req, res) => {
  try {
    const suppliers = await Supplier.findAll({
      attributes: ['AccountName', 'Address'],
      order: [['AccountName', 'ASC']]
    });
    
    res.json({
      success: true,
      data: suppliers.map(s => ({ 
        name: s.AccountName, 
        address: s.Address 
      }))
    });
  } catch (error) {
    console.error('Error fetching parties:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching parties',
      error: error.message
    });
  }
};

// Get all departments
exports.getDepartments = async (req, res) => {
  try {
    const departments = await Department.findAll({
      attributes: ['dept_id', 'dept_name'],
      order: [['dept_name', 'ASC']]
    });
    
    res.json({
      success: true,
      data: departments.map(d => ({ id: d.dept_id, name: d.dept_name }))
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

// Get all items for dropdown
exports.getItems = async (req, res) => {
  try {
    const items = await ItemMaster.findAll({
      attributes: ['ItemCode', 'ItemName'],
      order: [['ItemName', 'ASC']]
    });
    
    res.json({
      success: true,
      data: items.map(item => ({
        code: item.ItemCode,
        name: item.ItemName
      }))
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching items',
      error: error.message
    });
  }
};

// Get all gate pass outs
exports.getGatePassOuts = async (req, res) => {
  try {
    const gatePassOuts = await GatePassOut.findAll({
      include: [
        {
          model: GatePassOutDetail,
          as: 'details'
        }
      ],
      order: [['GpNo', 'DESC']]
    });
    
    res.json({
      success: true,
      data: gatePassOuts
    });
  } catch (error) {
    console.error('Error fetching gate pass outs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching gate pass outs',
      error: error.message
    });
  }
};

// Create gate pass out with details
exports.createGatePassOut = async (req, res) => {
  try {
    const {
      PartyName, Address, Department, GpDate, DespatchThrough,
      Returnable, Remarks, GpRefNo, items
    } = req.body;

    if (!PartyName || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Party name and items are required'
      });
    }

    // Create gate pass out
    const newGatePassOut = await GatePassOut.create({
      PartyName: PartyName.trim(),
      Address: Address ? Address.trim() : null,
      Department: Department ? Department.trim() : null,
      GpDate: GpDate || new Date(),
      DespatchThrough: DespatchThrough ? DespatchThrough.trim() : null,
      Returnable: Returnable || 'No',
      Remarks: Remarks ? Remarks.trim() : null,
      GpRefNo: GpRefNo ? GpRefNo.trim() : null
    });

    // Create gate pass out details
    for (const item of items) {
      await GatePassOutDetail.create({
        GpNo: newGatePassOut.GpNo,
        ItemName: item.ItemName,
        Qty: item.Qty || 0,
        Reason: item.Reason || null
      });
    }

    res.status(201).json({
      success: true,
      message: 'Gate Pass Out created successfully',
      data: newGatePassOut
    });
  } catch (error) {
    console.error('Error creating gate pass out:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating gate pass out',
      error: error.message
    });
  }
};

// Update gate pass out
exports.updateGatePassOut = async (req, res) => {
  try {
    const { gpNo } = req.params;
    const {
      PartyName, Address, Department, GpDate, DespatchThrough,
      Returnable, Remarks, GpRefNo, items
    } = req.body;

    const gatePassOut = await GatePassOut.findByPk(gpNo);
    if (!gatePassOut) {
      return res.status(404).json({
        success: false,
        message: 'Gate Pass Out not found'
      });
    }

    await gatePassOut.update({
      PartyName: PartyName ? PartyName.trim() : gatePassOut.PartyName,
      Address: Address ? Address.trim() : gatePassOut.Address,
      Department: Department ? Department.trim() : gatePassOut.Department,
      GpDate: GpDate || gatePassOut.GpDate,
      DespatchThrough: DespatchThrough ? DespatchThrough.trim() : gatePassOut.DespatchThrough,
      Returnable: Returnable || gatePassOut.Returnable,
      Remarks: Remarks ? Remarks.trim() : gatePassOut.Remarks,
      GpRefNo: GpRefNo ? GpRefNo.trim() : gatePassOut.GpRefNo
    });

    // Update details if provided
    if (items && items.length > 0) {
      await GatePassOutDetail.destroy({ where: { GpNo: gpNo } });
      
      for (const item of items) {
        await GatePassOutDetail.create({
          GpNo: gpNo,
          ItemName: item.ItemName,
          Qty: item.Qty || 0,
          Reason: item.Reason || null
        });
      }
    }

    res.json({
      success: true,
      message: 'Gate Pass Out updated successfully',
      data: gatePassOut
    });
  } catch (error) {
    console.error('Error updating gate pass out:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating gate pass out',
      error: error.message
    });
  }
};

// Delete gate pass out
exports.deleteGatePassOut = async (req, res) => {
  try {
    const { gpNo } = req.params;
    
    const gatePassOut = await GatePassOut.findByPk(gpNo);
    if (!gatePassOut) {
      return res.status(404).json({
        success: false,
        message: 'Gate Pass Out not found'
      });
    }

    // Delete details first
    await GatePassOutDetail.destroy({ where: { GpNo: gpNo } });

    // Then delete gate pass out
    await gatePassOut.destroy();

    res.json({
      success: true,
      message: 'Gate Pass Out deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting gate pass out:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting gate pass out',
      error: error.message
    });
  }
};