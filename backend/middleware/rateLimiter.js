const rateLimit = require('express-rate-limit');

// Strict limiter for authentication endpoints to block brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 login requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.'
  }
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500, // 1500 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests created from this IP, please try again after 15 minutes.'
  }
});

// Heavy operations limiter (reports, exports)
const heavyOpsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150, // 150 heavy requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many report requests from this IP, please try again shortly.'
  }
});

module.exports = {
  authLimiter,
  apiLimiter,
  heavyOpsLimiter
};
