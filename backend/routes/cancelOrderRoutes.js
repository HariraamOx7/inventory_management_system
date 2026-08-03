// backend/routes/cancelOrderRoutes.js
const express = require('express');
const router = express.Router();
const cancelOrderController = require('../controllers/cancelOrderController');

// Get last cancel number (for auto-increment)
router.get('/last-cancel-no', cancelOrderController.getLastCancelNo);

// Get all purchase orders for dropdown
router.get('/purchase-orders', cancelOrderController.getPurchaseOrders);

// Get purchase order by order number
router.get('/purchase-order-details', cancelOrderController.getPurchaseOrderByNo);

// Get all cancel orders
router.get('/', cancelOrderController.getCancelOrders);

// Create cancel order
router.post('/', cancelOrderController.createCancelOrder);

// Update cancel order
router.put('/:cancelNo', cancelOrderController.updateCancelOrder);

// Delete cancel order
router.delete('/:cancelNo', cancelOrderController.deleteCancelOrder);

module.exports = router;