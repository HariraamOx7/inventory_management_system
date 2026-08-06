const express = require('express');
const router = express.Router();
const billEntryController = require('../controllers/billEntryController');

router.get('/last-voucher-no', billEntryController.getLastVoucherNo);
router.get('/available-parties', billEntryController.getAvailableParties);
router.get('/available-gate-inwards', billEntryController.getAvailableGateInwards);
router.get('/available-grns', billEntryController.getAvailableGRNs);
router.get('/grn-details', billEntryController.getGRNDetails);
router.get('/print-data/:voucherNo', billEntryController.getPrintData);
router.get('/check-duplicate', billEntryController.checkDuplicateBillEntry);

router.get('/', billEntryController.getBillEntries);
router.post('/', billEntryController.createBillEntry);
router.put('/:voucherNo', billEntryController.updateBillEntry);
router.delete('/delete-chain/:voucherNo', billEntryController.deleteBillChain);
router.delete('/:voucherNo', billEntryController.deleteBillEntry);

module.exports = router;