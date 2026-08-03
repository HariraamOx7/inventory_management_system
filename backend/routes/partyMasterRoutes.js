const express = require('express');
const router = express.Router();
const { 
    getParties, 
    getSupplierByName,
    getSuppliers,
    addParty, 
    updateParty, 
    deleteParty 
} = require('../controllers/partyMasterController');

router.get('/', getParties);
router.get('/suppliers/all', getSuppliers);
router.get('/supplier-details', getSupplierByName);
router.post('/', addParty);
router.put('/:code', updateParty);
router.delete('/:code', deleteParty);

module.exports = router;