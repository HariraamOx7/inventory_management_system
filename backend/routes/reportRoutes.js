const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Filter options route
router.get('/filters/:type', reportController.getFilterOptions);

// ── 1. Purchase Reports ──────────────────────────────────────────────
router.get('/purchase/orderno-wise', reportController.getOrderNoWiseOrderDetails);
router.get('/purchase/supplier-wise', reportController.getSupplierWiseOrderDetails);
router.get('/purchase/department-wise', reportController.getDepartmentWiseOrderDetails);
router.get('/purchase/pending-wise', reportController.getPurchaseOrderPendingWise);
router.get('/purchase/pending-date-wise', reportController.getPurchaseOrderPendingDateWise);
router.get('/purchase/price-comparison', reportController.getPurchaseOrderPriceComparison);
router.get('/purchase/party-pending', reportController.getPurchaseOrderPartyWisePending);

// ── 2. Billing Reports ───────────────────────────────────────────────
router.get('/billing/day-book', reportController.getDayBook);
router.get('/billing/purchasetype-wise', reportController.getBillReportPurchaseTypeWise);
router.get('/billing/purchasetype-wise-abstract', reportController.getBillReportAbstractPurchaseTypeWise);
router.get('/billing/purchase-register', reportController.getPurchaseRegisterPurchaseTypeWise);
router.get('/billing/date-wise', reportController.getBillReportDateWise);
router.get('/billing/party-wise', reportController.getBillReportPartyWise);
router.get('/billing/party-wise-abstract', reportController.getBillReportAbstractPartyWise);
router.get('/billing/department-wise', reportController.getBillReportDepartmentWise);
router.get('/billing/department-wise-abstract', reportController.getBillReportAbstractDepartmentWise);
router.get('/billing/subhead-wise', reportController.getBillReportSubHeadWise);
router.get('/billing/item-wise', reportController.getBillReportItemWise);

// ── 3. Receipt Reports ───────────────────────────────────────────────
router.get('/receipt/date-wise', reportController.getDateWiseReceiptRegister);
router.get('/receipt/party-wise', reportController.getPartyWiseReceiptRegister);
router.get('/receipt/subhead-wise', reportController.getSubHeadWiseReceiptRegister);
router.get('/receipt/department-wise', reportController.getDepartmentWiseReceiptRegister);
router.get('/receipt/item-wise', reportController.getItemWiseReceiptRegister);
router.get('/receipt/return-pending', reportController.getReceiptReturnPending);

// ── 4. Stock Reports ─────────────────────────────────────────────────
router.get('/stock/item-wise-report', reportController.getItemWiseStockReport);
router.get('/stock/item-wise', reportController.exportItemWiseStock);
router.get('/stock/item-opening', reportController.getItemWiseOpeningStock);
router.get('/stock/department-wise', reportController.getDepartmentWiseStock);
router.get('/stock/department-closing', reportController.getDepartmentWiseClosingStock);
router.get('/stock/department-detail', reportController.getDepartmentWiseStockDetail);
router.get('/stock/subhead-wise', reportController.getSubHeadWiseStockAbstract);
router.get('/stock/subhead-detail', reportController.getSubHeadWiseStockDetail);
router.get('/stock/nil-stock', reportController.getNilStockItems);
router.get('/stock/max-level', reportController.getMaxLevelStockItems);

// ── 5. Others (Gate Pass & Location) Reports ─────────────────────────
router.get('/others/gatepass-pending', reportController.getGatePassPendingReport);
router.get('/others/gatepass-pending-party', reportController.getPartyWiseGatePassPending);
router.get('/others/gatepass-returnable-nonreturnable', reportController.getGatePassReturnableNonReturnable);
router.get('/others/gatepass-returnable-party', reportController.getGatePassReturnablePartyWise);
router.get('/others/gatepass-nonreturnable', reportController.getGatePassNonReturnableReport);
router.get('/others/gatepass-in', reportController.getGatePassInReport);
router.get('/others/gatepass-in-party', reportController.getGatePassInPartyWise);
router.get('/others/item-location', reportController.getItemRegisterLocationWise);

// ── 6. Issue Reports ─────────────────────────────────────────────────
router.get('/issue/date-wise', reportController.getDateWiseIssueRegister);
router.get('/issue/item-wise', reportController.getItemWiseIssueRegister);
router.get('/issue/subhead-wise', reportController.getSubHeadWiseIssueRegister);
router.get('/issue/department-wise', reportController.getDepartmentWiseIssueRegister);
router.get('/issue/month-movement-item', reportController.getMonthWiseItemMovementItemWise);
router.get('/issue/month-movement-dept', reportController.getMonthWiseItemMovementDepartmentWise);
router.get('/issue/month-movement-subhead', reportController.getMonthWiseItemMovementSubHeadWise);
router.get('/issue/department-item-wise', reportController.getDepartmentItemWiseIssueRegister);

module.exports = router;