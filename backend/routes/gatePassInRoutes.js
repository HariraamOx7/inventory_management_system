// backend/routes/gatePassInRoutes.js
const express = require('express');
const router = express.Router();
const gatePassInController = require('../controllers/gatePassInController');

// Get last IN number (for auto-increment)
router.get('/last-in-no', gatePassInController.getLastInNo);

// Get all parties for dropdown
router.get('/parties', gatePassInController.getParties);

// Get all items for dropdown
router.get('/items', gatePassInController.getItems);

// Get all gate pass ins
router.get('/', gatePassInController.getGatePassIns);

// Create gate pass in
router.post('/', gatePassInController.createGatePassIn);

// Update gate pass in
router.put('/:inNo', gatePassInController.updateGatePassIn);

// Delete gate pass in
router.delete('/:inNo', gatePassInController.deleteGatePassIn);

module.exports = router;