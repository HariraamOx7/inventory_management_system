const express = require('express');
const router = express.Router();
const { 
    getStates, 
    addState, 
    updateState, 
    deleteState 
} = require('../controllers/stateController');

router.get('/', getStates);
router.post('/', addState);
router.put('/:code', updateState);
router.delete('/:code', deleteState);

module.exports = router;