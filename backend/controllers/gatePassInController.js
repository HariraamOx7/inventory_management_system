// backend/controllers/gatePassInController.js
const GatePassIn = require('../models/GatePassIn');
const GatePassInDetail = require('../models/GatePassInDetail');
const Supplier = require('../models/Supplier');
const ItemMaster = require('../models/ItemMaster');

// Get last IN number
exports.getLastInNo = async (req, res) => {
  try {
    const lastIn = await GatePassIn.findOne({
      order: [['InNo', 'DESC']]
    });
    
    res.json({
      success: true,
      data: { lastInNo: lastIn ? lastIn.InNo : 0 }
    });
  } catch (error) {
    console.error('Error fetching last IN number:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching IN number',
      error: error.message
    });
  }
};

// Get all parties (suppliers) for dropdown
exports.getParties = async (req, res) => {
  try {
    const suppliers = await Supplier.findAll({
      attributes: ['AccountName'],
      order: [['AccountName', 'ASC']]
    });
    
    res.json({
      success: true,
      data: suppliers.map(s => ({ name: s.AccountName }))
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

// Get all gate pass ins
exports.getGatePassIns = async (req, res) => {
  try {
    const gatePassIns = await GatePassIn.findAll({
      include: [
        {
          model: GatePassInDetail,
          as: 'details'
        }
      ],
      order: [['InNo', 'DESC']]
    });
    
    res.json({
      success: true,
      data: gatePassIns
    });
  } catch (error) {
    console.error('Error fetching gate pass ins:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching gate pass ins',
      error: error.message
    });
  }
};

// Create gate pass in with details
exports.createGatePassIn = async (req, res) => {
  try {
    const {
      PartyName, GiDate, DcNo, DcDate, InvoiceNo, InvoiceDate, LrcNo, items
    } = req.body;

    if (!PartyName || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Party name and items are required'
      });
    }

    // Create gate pass in
    const newGatePassIn = await GatePassIn.create({
      PartyName: PartyName.trim(),
      GiDate: GiDate || new Date(),
      DcNo: DcNo ? DcNo.trim() : null,
      DcDate: DcDate || null,
      InvoiceNo: InvoiceNo ? InvoiceNo.trim() : null,
      InvoiceDate: InvoiceDate || null,
      LrcNo: LrcNo ? LrcNo.trim() : null
    });

    // Create gate pass in details
    for (const item of items) {
      await GatePassInDetail.create({
        InNo: newGatePassIn.InNo,
        ItemName: item.ItemName,
        PendingQty: item.PendingQty || 0,
        RecQty: item.RecQty || 0,
        GpNo: item.GpNo || null,
        Reason: item.Reason || null
      });
    }

    res.status(201).json({
      success: true,
      message: 'Gate Pass In created successfully',
      data: newGatePassIn
    });
  } catch (error) {
    console.error('Error creating gate pass in:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating gate pass in',
      error: error.message
    });
  }
};

// Update gate pass in
exports.updateGatePassIn = async (req, res) => {
  try {
    const { inNo } = req.params;
    const {
      PartyName, GiDate, DcNo, DcDate, InvoiceNo, InvoiceDate, LrcNo, items
    } = req.body;

    const gatePassIn = await GatePassIn.findByPk(inNo);
    if (!gatePassIn) {
      return res.status(404).json({
        success: false,
        message: 'Gate Pass In not found'
      });
    }

    await gatePassIn.update({
      PartyName: PartyName ? PartyName.trim() : gatePassIn.PartyName,
      GiDate: GiDate || gatePassIn.GiDate,
      DcNo: DcNo ? DcNo.trim() : gatePassIn.DcNo,
      DcDate: DcDate || gatePassIn.DcDate,
      InvoiceNo: InvoiceNo ? InvoiceNo.trim() : gatePassIn.InvoiceNo,
      InvoiceDate: InvoiceDate || gatePassIn.InvoiceDate,
      LrcNo: LrcNo ? LrcNo.trim() : gatePassIn.LrcNo
    });

    // Update details if provided
    if (items && items.length > 0) {
      await GatePassInDetail.destroy({ where: { InNo: inNo } });
      
      for (const item of items) {
        await GatePassInDetail.create({
          InNo: inNo,
          ItemName: item.ItemName,
          PendingQty: item.PendingQty || 0,
          RecQty: item.RecQty || 0,
          GpNo: item.GpNo || null,
          Reason: item.Reason || null
        });
      }
    }

    res.json({
      success: true,
      message: 'Gate Pass In updated successfully',
      data: gatePassIn
    });
  } catch (error) {
    console.error('Error updating gate pass in:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating gate pass in',
      error: error.message
    });
  }
};

// Delete gate pass in
exports.deleteGatePassIn = async (req, res) => {
  try {
    const { inNo } = req.params;
    
    const gatePassIn = await GatePassIn.findByPk(inNo);
    if (!gatePassIn) {
      return res.status(404).json({
        success: false,
        message: 'Gate Pass In not found'
      });
    }

    // Delete details first
    await GatePassInDetail.destroy({ where: { InNo: inNo } });

    // Then delete gate pass in
    await gatePassIn.destroy();

    res.json({
      success: true,
      message: 'Gate Pass In deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting gate pass in:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting gate pass in',
      error: error.message
    });
  }
};