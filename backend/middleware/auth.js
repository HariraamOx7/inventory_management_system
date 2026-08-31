const jwt = require('jsonwebtoken');
const { User } = require('../models/index');

const auth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const secret = process.env.JWT_SECRET || 'stores-secure-jwt-key-2026';
    const decoded = jwt.verify(token, secret);

    // Verify user exists and is active
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'username', 'full_name', 'email', 'role', 'status']
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account no longer exists.'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.'
      });
    }

    req.user = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please log in again.'
    });
  }
};

/**
 * Role-Based Access Control middleware helper
 * @param  {...string} roles - Allowed roles ('admin', 'manager', 'operator', 'viewer')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: role '${req.user.role}' is not authorized to access this resource`
      });
    }

    next();
  };
};

module.exports = {
  auth,
  authorize
};