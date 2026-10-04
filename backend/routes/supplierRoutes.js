const express = require('express');
const router = express.Router();
const { 
    getSuppliers, 
    addSupplier, 
    updateSupplier, 
    deleteSupplier,
    getLastCode
} = require('../controllers/supplierController');

router.get('/', getSuppliers);
router.get('/last-code', getLastCode);
router.post('/', addSupplier);
router.put('/:partyCode', updateSupplier);
router.delete('/:partyCode', deleteSupplier);

module.exports = router;