#!/usr/bin/env node
// Manual demo seed for sales demos. Refuses to run if leads already exist.
// The actual data lives in server/services/seedDemo.js (shared with boot-time
// auto-seed in server/index.js).
require('dotenv').config();
const { getDb } = require('../server/db');
const { seedDemoData } = require('../server/services/seedDemo');

const db = getDb();
if (db.prepare('SELECT COUNT(*) AS n FROM leads').get().n > 0) {
  console.error('database already has leads — refusing to seed');
  process.exit(1);
}

seedDemoData(db);
