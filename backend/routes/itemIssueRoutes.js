// backend/routes/itemIssueRoutes.js
const express = require('express');
const router = express.Router();
const itemIssueController = require('../controllers/itemIssueController');

// Get last issue number (for auto-increment)
router.get('/last-issue-no', itemIssueController.getLastIssueNo);

// Get all departments for dropdown
router.get('/departments', itemIssueController.getDepartments);

router.get('/items-by-department', itemIssueController.getItemsByDepartment);

// Get all items for dropdown
router.get('/items', itemIssueController.getItems);

// Get all item issues
router.get('/', itemIssueController.getItemIssues);

// Create item issue
router.post('/', itemIssueController.createItemIssue);

// Update item issue
router.put('/:issueNo', itemIssueController.updateItemIssue);

// Delete item issue
router.delete('/:issueNo', itemIssueController.deleteItemIssue);



module.exports = router;