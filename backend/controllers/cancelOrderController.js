// backend/controllers/cancelOrderController.js
const CancelOrder = require('../models/CancelOrder');
const PurchaseOrder = require('../models/PurchaseOrder');

// Get last cancel number (for auto-increment)
exports.getLastCancelNo = async (req, res) => {
  try {
    const lastCancel = await CancelOrder.findOne({
      order: [['CancelNo', 'DESC']]
    });
    
    res.json({
      success: true,
      data: { lastCancelNo: lastCancel ? lastCancel.CancelNo : 0 }
    });
  } catch (error) {
    console.error('Error fetching last cancel number:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cancel number',
      error: error.message
    });
  }
};

// Get all cancel orders
exports.getCancelOrders = async (req, res) => {
  try {
    const cancelOrders = await CancelOrder.findAll({
      order: [['CancelNo', 'DESC']]
    });
    
    res.json({
      success: true,
      data: cancelOrders
    });
  } catch (error) {
    console.error('Error fetching cancel orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cancel orders',
      error: error.message
    });
  }
};

// Get all purchase orders for dropdown (with order details)
exports.getPurchaseOrders = async (req, res) => {
  try {
    const orders = await PurchaseOrder.findAll({
      attributes: ['OrderNo', 'OrderDate', 'PartyName'],
      order: [['OrderNo', 'DESC']]
    });
    
    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchase orders',
      error: error.message
    });
  }
};

// Get purchase order by order number
exports.getPurchaseOrderByNo = async (req, res) => {
  try {
    const { orderNo } = req.query;
    
    if (!orderNo) {
      return res.status(400).json({
        success: false,
        message: 'Order number is required'
      });
    }

    const order = await PurchaseOrder.findByPk(orderNo, {
      attributes: ['OrderNo', 'OrderDate', 'PartyName', 'Address']
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchase order',
      error: error.message
    });
  }
};

// Create cancel order
exports.createCancelOrder = async (req, res) => {
  try {
    const { OrderNo, PartyName, CancelDate, Reason } = req.body;

    if (!OrderNo || !PartyName) {
      return res.status(400).json({
        success: false,
        message: 'Order number and party name are required'
      });
    }

    const cancelOrder = await CancelOrder.create({
      OrderNo,
      PartyName,
      CancelDate: CancelDate || new Date(),
      Reason,
      Status: 'Active'
    });

    res.status(201).json({
      success: true,
      message: 'Cancel order created successfully',
      data: cancelOrder
    });
  } catch (error) {
    console.error('Error creating cancel order:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating cancel order',
      error: error.message
    });
  }
};

// Update cancel order
exports.updateCancelOrder = async (req, res) => {
  try {
    const { cancelNo } = req.params;
    const { OrderNo, PartyName, CancelDate, Reason, Status } = req.body;

    const cancelOrder = await CancelOrder.findByPk(cancelNo);
    
    if (!cancelOrder) {
      return res.status(404).json({
        success: false,
        message: 'Cancel order not found'
      });
    }

    await cancelOrder.update({
      OrderNo,
      PartyName,
      CancelDate,
      Reason,
      Status
    });

    res.json({
      success: true,
      message: 'Cancel order updated successfully',
      data: cancelOrder
    });
  } catch (error) {
    console.error('Error updating cancel order:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating cancel order',
      error: error.message
    });
  }
};

// Delete cancel order
exports.deleteCancelOrder = async (req, res) => {
  try {
    const { cancelNo } = req.params;

    const cancelOrder = await CancelOrder.findByPk(cancelNo);
    
    if (!cancelOrder) {
      return res.status(404).json({
        success: false,
        message: 'Cancel order not found'
      });
    }

    await cancelOrder.destroy();

    res.json({
      success: true,
      message: 'Cancel order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting cancel order:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting cancel order',
      error: error.message
    });
  }
};