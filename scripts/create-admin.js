#!/usr/bin/env node
// Usage: node scripts/create-admin.js "Name" email@example.com password123456
require('dotenv').config();
const bcrypt = require('bcrypt');
const { getDb } = require('../server/db');
const { nowIST } = require('../server/lib/time');

const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password) {
  console.error('usage: node scripts/create-admin.js "Name" email password');
  process.exit(1);
}
if (password.length < 10) {
  console.error('password must be at least 10 characters');
  process.exit(1);
}

const db = getDb();
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
if (existing) {
  console.log(`user ${email} already exists (id ${existing.id}) — nothing to do`);
  process.exit(0);
}
const now = nowIST();
const info = db
  .prepare(
    "INSERT INTO users (name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, 'owner', ?, ?)"
  )
  .run(name, email.toLowerCase(), bcrypt.hashSync(password, 12), now, now);
console.log(`owner account created: ${email} (id ${info.lastInsertRowid})`);
