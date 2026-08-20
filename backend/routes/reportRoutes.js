const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Filter options
router.get('/filter-options', reportController.getFilterOptions);

// Receipt reports
router.get('/receipt/date-wise', reportController.getDateWiseReceiptRegister);
router.get('/receipt/party-wise', reportController.getPartyWiseReceiptRegister);
router.get('/receipt/department-wise', reportController.getDepartmentWiseReceiptRegister);
router.get('/receipt/item-wise', reportController.getItemWiseReceiptRegister);

// Purchase order reports
router.get('/purchase/supplier-wise', reportController.getSupplierWiseOrderDetails);
router.get('/purchase/department-wise', reportController.getDepartmentWiseOrderDetails);

// Issue reports
router.get('/issue/date-wise', reportController.getDateWiseIssueRegister);
router.get('/issue/item-wise', reportController.getItemWiseIssueRegister);
router.get('/issue/department-wise', reportController.getDepartmentWiseIssueRegister);

// Stock reports
router.get('/stock/department-wise', reportController.getDepartmentWiseStock);
router.get('/stock/item-wise', reportController.exportItemWiseStock);

module.exports = router;