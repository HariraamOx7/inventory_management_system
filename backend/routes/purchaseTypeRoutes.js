const express = require('express');
const router = express.Router();
const purchaseTypeController = require('../controllers/purchaseTypeController');

router.get('/', purchaseTypeController.getPurchaseTypes);
router.get('/next-code', purchaseTypeController.getNextCode);
router.get('/default-formulas', purchaseTypeController.getDefaultFormulas);
router.get('/:code', purchaseTypeController.getPurchaseTypeByCode);
router.post('/', purchaseTypeController.addPurchaseType);
router.put('/:code', purchaseTypeController.updatePurchaseType);
router.delete('/:code', purchaseTypeController.deletePurchaseType);

module.exports = router;