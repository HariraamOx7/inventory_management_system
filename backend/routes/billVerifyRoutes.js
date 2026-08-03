// backend/routes/billVerifyRoutes.js
const express = require('express');
const router = express.Router();
const billVerifyController = require('../controllers/billVerifyController');

// Get all party names for dropdown
router.get('/party-names', billVerifyController.getPartyNames);

// Get bills by party name
router.get('/bills-by-party', billVerifyController.getBillsByParty);

// Get bill verify records with filters
router.get('/', billVerifyController.getBillVerifyRecords);

// Create bill verify record
router.post('/', billVerifyController.createBillVerify);

// Update bill verify record
router.put('/:verifyNo', billVerifyController.updateBillVerify);

// Delete bill verify record
router.delete('/:verifyNo', billVerifyController.deleteBillVerify);

module.exports = router;