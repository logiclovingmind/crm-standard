import os from 'os';
import path from 'path';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { nowIST } from '../lib/time.js';

export function setupTestEnv(name) {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-secret';
  process.env.DB_PATH = path.join(os.tmpdir(), `crm-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

// bcrypt cost 4 keeps tests fast; login only compares, cost is irrelevant.
export function seedUser(db, { name, email, role }) {
  const now = nowIST();
  return db
    .prepare('INSERT INTO users (name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, email, bcrypt.hashSync('test-password-1', 4), role, now, now).lastInsertRowid;
}

export function seedLead(db, { name, phone, assignedTo = null, status = 'New', source = 'other' }) {
  const now = nowIST();
  return db
    .prepare(
      'INSERT INTO leads (name, phone, source, status, assigned_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(name, phone, source, status, assignedTo, now, now).lastInsertRowid;
}

export async function loginAgent(app, email) {
  const agent = request.agent(app);
  const csrfRes = await agent.get('/api/auth/csrf');
  const login = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', csrfRes.body.csrfToken)
    .send({ email, password: 'test-password-1' });
  if (login.status !== 200) throw new Error(`login failed for ${email}: ${login.status}`);
  agent.csrfToken = login.body.csrfToken;
  return agent;
}

