const express = require('express');
const router = express.Router();
const { 
    getDepartments, 
    addDepartment, 
    updateDepartment, 
    deleteDepartment 
} = require('../controllers/departmentController');

router.get('/', getDepartments);
router.post('/', addDepartment);
router.put('/:dept_id', updateDepartment);
router.delete('/:dept_id', deleteDepartment);

module.exports = router;