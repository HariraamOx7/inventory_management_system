// backend/routes/gateInwardRoutes.js
const express = require('express');
const router = express.Router();
const gateInwardController = require('../controllers/gateInwardController');

// Get all parties from purchase orders
router.get('/get-parties', gateInwardController.getParties);

// Get items for a specific party
router.get('/items-by-party', gateInwardController.getItemsByParty);

// Get last inward number (for auto-increment)
router.get('/last-inward-no', gateInwardController.getLastInwardNo);

// Get all purchase orders for dropdown
router.get('/purchase-orders', gateInwardController.getPurchaseOrders);

// Get items for a specific purchase order
router.get('/order-items', gateInwardController.getPurchaseOrderItems);

// Get all gate inwards
router.get('/', gateInwardController.getGateInwards);

// Get single gate inward by ID
router.get('/:inwardNo', gateInwardController.getGateInwardById);

// Create gate inward
router.post('/', gateInwardController.createGateInward);

// Update gate inward
router.put('/:inwardNo', gateInwardController.updateGateInward);

// Delete gate inward
router.delete('/:inwardNo', gateInwardController.deleteGateInward);

module.exports = router;

