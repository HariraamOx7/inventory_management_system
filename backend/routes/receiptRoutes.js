const express = require('express');
const router = express.Router();
const receiptController = require('../controllers/receiptController');

router.get('/last-grn-no', receiptController.getLastGRNNo);
router.get('/parties', receiptController.getParties);

// New endpoints used by frontend
router.get('/available-gate-inwards', receiptController.getAvailableGateInwards);
router.get('/gate-inward-details', receiptController.getGateInwardDetails);

// Existing endpoints
router.get('/gate-inwards-by-party', receiptController.getGateInwardsByParty);
router.get('/inward-items', receiptController.getGateInwardItems);

router.get('/', receiptController.getReceipts);
router.post('/', receiptController.createReceipt);
router.put('/:grnNo', receiptController.updateReceipt);
router.delete('/:grnNo', receiptController.deleteReceipt);

module.exports = router;