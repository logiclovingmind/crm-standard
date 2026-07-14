require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const SqliteStore = require('better-sqlite3-session-store')(session);
const { getDb } = require('./db');
const { nowIST } = require('./lib/time');
const { csrfProtect } = require('./middleware/csrf');
const { requireAuth, requireRole } = require('./middleware/auth');

// Render's free tier wipes SQLite on every redeploy, so we re-seed a demo
// owner from env vars on startup. No-op if SEED_EMAIL/SEED_PASSWORD unset,
// or if a user with that email already exists.
function seedDemoUser(db) {
  const email = (process.env.SEED_EMAIL || '').trim().toLowerCase();
  const password = process.env.SEED_PASSWORD || '';
  const name = (process.env.SEED_NAME || '').trim() || 'Demo';
  if (!email || !password) return;
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return;
  const now = nowIST();
  db.prepare(
    "INSERT INTO users (name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, 'owner', ?, ?)"
  ).run(name, email, bcrypt.hashSync(password, 12), now, now);
  console.log(`seeded demo user: ${email}`);
}

function createApp() {
  const db = getDb();
  seedDemoUser(db);
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is required in production');
  }

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));

  app.use(
    session({
      store: new SqliteStore({ client: db, expired: { clear: true, intervalMs: 15 * 60 * 1000 } }),
      secret: process.env.SESSION_SECRET || 'dev-only-secret',
      name: 'crm.sid',
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 12 * 60 * 60 * 1000 },
    })
  );

  // Health check — no auth, used by Render and uptime monitors.
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Bot integration uses bearer token auth, not sessions/CSRF — mounted before csrfProtect.
  app.use('/api/integrations', require('./routes/integrations'));

  app.use('/api', csrfProtect);
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/leads', requireAuth, require('./routes/leads'));
  app.use('/api/inventory', requireAuth, require('./routes/inventory'));
  app.use('/api/visits', requireAuth, require('./routes/visits'));
  app.use('/api/dashboard', requireAuth, require('./routes/dashboard'));
  app.use('/api/export', requireAuth, requireRole('owner'), require('./routes/export'));
  app.use('/api/users', requireAuth, require('./routes/users'));
  app.use('/api/settings', requireAuth, requireRole('owner'), require('./routes/settings'));

  app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

  // On the droplet Caddy serves the client; SERVE_CLIENT=1 is for standalone
  // hosting (e.g. LAN self-host) where Express serves the built SPA itself.
  if (process.env.SERVE_CLIENT === '1') {
    const dist = path.join(__dirname, '..', 'client', 'dist');
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '127.0.0.1';
  createApp().listen(port, host, () => {
    console.log(`CRM API listening on ${host}:${port}`);
  });
}

module.exports = { createApp };
