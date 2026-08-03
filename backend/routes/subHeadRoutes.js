const express = require('express');
const router = express.Router();
const { 
    getLastCode,
    getSubHeads,
    getSubHeadsByDepartment,
    addSubHead, 
    updateSubHead, 
    deleteSubHead 
} = require('../controllers/subHeadController');

router.get('/last-code',getLastCode);
router.get('/', getSubHeads);
router.get('/by-department', getSubHeadsByDepartment);
router.post('/', addSubHead);
router.put('/:code', updateSubHead);
router.delete('/:code', deleteSubHead);


module.exports = router;