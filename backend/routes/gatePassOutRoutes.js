// backend/routes/gatePassOutRoutes.js
const express = require('express');
const router = express.Router();
const gatePassOutController = require('../controllers/gatePassOutController');

// Get last GP number (for auto-increment)
router.get('/last-gp-no', gatePassOutController.getLastGpNo);

// Get all parties for dropdown
router.get('/parties', gatePassOutController.getParties);

// Get all departments
router.get('/departments', gatePassOutController.getDepartments);

// Get all items for dropdown
router.get('/items', gatePassOutController.getItems);

// Get all gate pass outs
router.get('/', gatePassOutController.getGatePassOuts);

// Create gate pass out
router.post('/', gatePassOutController.createGatePassOut);

// Update gate pass out
router.put('/:gpNo', gatePassOutController.updateGatePassOut);

// Delete gate pass out
router.delete('/:gpNo', gatePassOutController.deleteGatePassOut);

module.exports = router;