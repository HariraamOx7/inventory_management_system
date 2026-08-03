const express = require('express');
const router = express.Router();
const { 
    getUoms, 
    addUom, 
    updateUom, 
    deleteUom 
} = require('../controllers/uomController');

router.get('/', getUoms);
router.post('/', addUom);
router.put('/:id', updateUom);
router.delete('/:id', deleteUom);

module.exports = router;