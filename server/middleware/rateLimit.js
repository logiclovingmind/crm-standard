const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  // Only failed logins count toward the limit — a successful sign-in shouldn't
  // penalize an agent who fumbled their password once before getting it right.
  skipSuccessfulRequests: true,
  message: { error: 'too many login attempts, try again later' },
});

module.exports = { loginLimiter };
