const express = require('express');
const router = express.Router();
const { 
    getProductHeads, 
    addProductHead, 
    updateProductHead, 
    deleteProductHead 
} = require('../controllers/prodHeadController');

router.get('/', getProductHeads);
router.post('/', addProductHead);
router.put('/', updateProductHead);
router.delete('/', deleteProductHead);
router.put('/:code', updateProductHead);
router.delete('/:code', deleteProductHead);

module.exports = router;