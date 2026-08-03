// backend/routes/purchaseOrderRoutes.js
const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');

// Get last order number (for auto-increment)
router.get('/last-order-no', purchaseOrderController.getLastOrderNo);

// Get all suppliers for dropdown
router.get('/suppliers', purchaseOrderController.getSuppliers);

// Get all items for dropdown
router.get('/items', purchaseOrderController.getItems);

// Get supplier details by name
router.get('/supplier-details', purchaseOrderController.getSupplierByName);

// Get all purchase orders
router.get('/', purchaseOrderController.getPurchaseOrders);

// Create purchase order
router.post('/', purchaseOrderController.createPurchaseOrder);

// Update purchase order
router.put('/:orderNo', purchaseOrderController.updatePurchaseOrder);

// Delete purchase order
router.delete('/:orderNo', purchaseOrderController.deletePurchaseOrder);

router.get('/:orderNo', purchaseOrderController.getPurchaseOrderById);

module.exports = router;