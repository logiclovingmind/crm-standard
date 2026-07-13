const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../db');
const { nowIST } = require('../lib/time');
const { requireRole } = require('../middleware/auth');
const { audit } = require('../lib/audit');

const router = express.Router();
const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 10;

// Managers need the agent list to assign leads; everything else is owner-only.
router.get('/assignable', requireRole('owner', 'manager'), (req, res) => {
  const rows = getDb()
    .prepare("SELECT id, name, role FROM users WHERE active = 1 ORDER BY name")
    .all();
  res.json({ users: rows });
});

router.use(requireRole('owner'));

router.get('/', (req, res) => {
  const rows = getDb()
    .prepare('SELECT id, name, email, phone, role, language, active, created_at FROM users ORDER BY name')
    .all();
  res.json({ users: rows });
});

router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, password, role } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'valid email required' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    if (!['owner', 'manager', 'agent'].includes(role)) return res.status(400).json({ error: 'invalid role' });

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) return res.status(409).json({ error: 'email already in use' });

    const hash = await bcrypt.hash(password, BCRYPT_COST);
    const now = nowIST();
    const info = db
      .prepare(
        'INSERT INTO users (name, email, phone, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(name.trim(), email.trim().toLowerCase(), phone || null, hash, role, now, now);
    audit(req.session.user.id, 'user_created', `user ${info.lastInsertRowid} (${role})`);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'not found' });

  const { name, phone, role, active } = req.body || {};
  if (role !== undefined && !['owner', 'manager', 'agent'].includes(role)) {
    return res.status(400).json({ error: 'invalid role' });
  }
  if (user.id === req.session.user.id && (active === 0 || active === false)) {
    return res.status(400).json({ error: 'cannot deactivate yourself' });
  }
  db.prepare(
    'UPDATE users SET name = ?, phone = ?, role = ?, active = ?, updated_at = ? WHERE id = ?'
  ).run(
    typeof name === 'string' && name.trim() ? name.trim() : user.name,
    phone !== undefined ? phone : user.phone,
    role ?? user.role,
    active !== undefined ? (active ? 1 : 0) : user.active,
    nowIST(),
    user.id
  );
  audit(req.session.user.id, 'user_updated', `user ${user.id}`);
  res.json({ ok: true });
});

router.put('/:id/password', async (req, res, next) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'not found' });
    const { password } = req.body || {};
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, nowIST(), user.id);
    audit(req.session.user.id, 'user_password_reset', `user ${user.id}`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
