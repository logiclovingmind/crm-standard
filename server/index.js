require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
const { getDb } = require('./db');
const { csrfProtect } = require('./middleware/csrf');
const { requireAuth, requireRole } = require('./middleware/auth');

function createApp() {
  const db = getDb();
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
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, '127.0.0.1', () => {
    console.log(`CRM API listening on 127.0.0.1:${port}`);
  });
}

module.exports = { createApp };
