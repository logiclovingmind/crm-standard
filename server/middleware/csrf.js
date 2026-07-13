const crypto = require('crypto');

function ensureCsrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  return req.session.csrfToken;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function csrfProtect(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.get('x-csrf-token');
  if (!token || !req.session.csrfToken || !safeEqual(token, req.session.csrfToken)) {
    return res.status(403).json({ error: 'invalid csrf token' });
  }
  next();
}

module.exports = { csrfProtect, ensureCsrfToken, safeEqual };
