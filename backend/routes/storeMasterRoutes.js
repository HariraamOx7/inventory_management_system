const express = require('express');
const router = express.Router();
const { 
    getStores, 
    addStore, 
    updateStore, 
    deleteStore 
} = require('../controllers/storeMasterController');

router.get('/', getStores);
router.post('/', addStore);
router.put('/', updateStore);
router.delete('/', deleteStore);
router.put('/:id', updateStore);
router.delete('/:id', deleteStore);

module.exports = router;