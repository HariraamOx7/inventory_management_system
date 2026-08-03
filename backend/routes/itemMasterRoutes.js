const express = require('express');
const router = express.Router();
const { 
    generateItemCode,
    getSubHeadsByDepartment,
    getItemMasters, 
    getDepartments,
    getUOMs,
    addItemMaster, 
    updateItemMaster, 
    deleteItemMaster 
} = require('../controllers/itemMasterController');

router.post('/generate-code', generateItemCode);
router.get('/sub-heads-by-dept', getSubHeadsByDepartment);
router.get('/', getItemMasters);
router.get('/departments/all', getDepartments);
router.get('/uoms/all', getUOMs);
router.post('/', addItemMaster);
router.put('/:code', updateItemMaster);
router.delete('/:code', deleteItemMaster);

module.exports = router;