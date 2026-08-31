const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth, authorize } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// Login route with brute-force protection
router.post('/login', authLimiter, authController.login);

// Get current user profile (protected route)
router.get('/me', auth, authController.getCurrentUser);

// Change password (protected route)
router.put('/change-password', auth, authController.changePassword);

// Register new user (admin only)
router.post('/register', auth, authorize('admin'), authController.register);

module.exports = router;