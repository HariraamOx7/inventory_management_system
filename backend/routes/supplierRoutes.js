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
router.put('/:accCode', updateSupplier);
router.delete('/:accCode', deleteSupplier);

module.exports = router;