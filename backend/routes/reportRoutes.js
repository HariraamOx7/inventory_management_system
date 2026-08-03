const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

router.get('/stock/item-wise', reportController.exportItemWiseStock);

module.exports = router;