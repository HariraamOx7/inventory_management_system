const express = require('express');
const router = express.Router();
const purchaseTypeController = require('../controllers/purchaseTypeController');

router.get('/purchase-types', purchaseTypeController.getPurchaseTypes);
router.get('/purchase-types/next-code', purchaseTypeController.getNextCode);
router.get('/purchase-types/default-formulas', purchaseTypeController.getDefaultFormulas);
router.get('/purchase-types/:code', purchaseTypeController.getPurchaseTypeByCode);
router.post('/purchase-types', purchaseTypeController.addPurchaseType);
router.put('/purchase-types/:code', purchaseTypeController.updatePurchaseType);
router.delete('/purchase-types/:code', purchaseTypeController.deletePurchaseType);

module.exports = router;