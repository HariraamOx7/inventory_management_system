const express = require('express');
const router = express.Router();
const { 
    getItems, 
    addItem, 
    updateItem, 
    deleteItem,
    bulkUploadItems
} = require('../controllers/itemController');

router.get('/', getItems);
router.post('/', addItem);
router.put('/:code', updateItem);
router.delete('/:code', deleteItem);
router.post('/bulk-upload', bulkUploadItems);

module.exports = router;