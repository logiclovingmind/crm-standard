const express = require('express');
const { getDb } = require('../db');
const { audit } = require('../lib/audit');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT key, value FROM settings').all();
  res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
});

router.put('/', (req, res) => {
  const entries = Object.entries(req.body || {});
  if (!entries.length) return res.status(400).json({ error: 'no settings provided' });
  const db = getDb();
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  db.transaction(() => {
    for (const [key, value] of entries) upsert.run(String(key), value == null ? null : String(value));
  })();
  audit(req.session.user.id, 'settings_updated', entries.map(([k]) => k).join(','));
  res.json({ ok: true });
});

module.exports = router;
