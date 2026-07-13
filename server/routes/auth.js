const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../db');
const { nowIST } = require('../lib/time');
const { ensureCsrfToken } = require('../middleware/csrf');
const { loginLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/csrf', (req, res) => {
  res.json({ csrfToken: ensureCsrfToken(req) });
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'email and password required' });
    }
    const db = getDb();
    const user = db
      .prepare('SELECT * FROM users WHERE email = ? AND active = 1')
      .get(email.trim().toLowerCase());
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        language: user.language,
      };
      const csrfToken = ensureCsrfToken(req);
      res.json({ user: req.session.user, csrfToken });
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('crm.sid');
    res.json({ ok: true });
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user, csrfToken: ensureCsrfToken(req) });
});

router.put('/me/language', requireAuth, (req, res) => {
  const { language } = req.body || {};
  if (!['en', 'kn'].includes(language)) return res.status(400).json({ error: 'invalid language' });
  getDb()
    .prepare('UPDATE users SET language = ?, updated_at = ? WHERE id = ?')
    .run(language, nowIST(), req.session.user.id);
  req.session.user.language = language;
  res.json({ ok: true, language });
});

module.exports = router;
