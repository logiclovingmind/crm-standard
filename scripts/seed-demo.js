#!/usr/bin/env node
// Demo brokerage data for sales demos. Idempotent-ish: refuses to run if leads exist.
require('dotenv').config();
const bcrypt = require('bcrypt');
const { getDb } = require('../server/db');
const { nowIST, istHoursAgo } = require('../server/lib/time');

const db = getDb();
if (db.prepare('SELECT COUNT(*) AS n FROM leads').get().n > 0) {
  console.error('database already has leads — refusing to seed');
  process.exit(1);
}

const now = nowIST();
const hash = bcrypt.hashSync('demo-password-123', 12);

const insertUser = db.prepare(
  'INSERT INTO users (name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
);
const owner = insertUser.run('Prakash Rao', 'owner@demo.crm', hash, 'owner', now, now).lastInsertRowid;
const manager = insertUser.run('Sunita Hegde', 'manager@demo.crm', hash, 'manager', now, now).lastInsertRowid;
const agent1 = insertUser.run('Ravi Kumar', 'ravi@demo.crm', hash, 'agent', now, now).lastInsertRowid;
const agent2 = insertUser.run('Deepa Shetty', 'deepa@demo.crm', hash, 'agent', now, now).lastInsertRowid;

const insertProject = db.prepare(
  'INSERT INTO projects (name, location, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
);
const p1 = insertProject.run('Brigade Meadows', 'Whitefield, Bengaluru', 'Premium 2/3 BHK apartments', now, now).lastInsertRowid;
const p2 = insertProject.run('Green Acres Layout', 'Sarjapur Road, Bengaluru', 'BMRDA approved plots', now, now).lastInsertRowid;

const insertUnit = db.prepare(
  'INSERT INTO units (project_id, identifier, type, area_sqft, price, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
insertUnit.run(p1, 'A-1203', '2BHK', 1150, 8200000, 'available', now, now);
insertUnit.run(p1, 'A-1204', '2BHK', 1150, 8250000, 'blocked', now, now);
insertUnit.run(p1, 'B-0402', '3BHK', 1580, 11500000, 'available', now, now);
insertUnit.run(p2, 'Plot-17', 'plot', 1200, 4800000, 'available', now, now);
insertUnit.run(p2, 'Plot-18', 'plot', 1500, 6000000, 'sold', now, now);

const insertLead = db.prepare(
  `INSERT INTO leads (name, phone, source, status, requirement, assigned_to, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
const insertActivity = db.prepare(
  'INSERT INTO lead_activity (lead_id, user_id, type, to_status, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)'
);
const leads = [
  ['Anil Sharma', '+919845010001', 'whatsapp', 'New', '2BHK, Whitefield, budget 80L', agent1, istHoursAgo(100)],
  ['Meera Nair', '+919845010002', 'whatsapp', 'Contacted', '3BHK, budget 1.2Cr', agent1, istHoursAgo(20)],
  ['Suresh Gowda', '+919845010003', '99acres', 'Site Visit', 'Plot in Sarjapur', agent2, istHoursAgo(80)],
  ['Farah Khan', '+919845010004', 'walk-in', 'Negotiation', '2BHK ready to move', agent2, istHoursAgo(5)],
  ['Vikram Patil', '+919845010005', 'referral', 'Closed', 'Plot, closed at 60L', agent1, istHoursAgo(300)],
  ['Lakshmi Iyer', '+919845010006', 'magicbricks', 'Lost', 'Wanted villa, over budget', agent2, istHoursAgo(400)],
];
for (const [name, phone, source, status, req, assignee, createdAt] of leads) {
  const id = insertLead.run(name, phone, source, status, req, assignee, createdAt, createdAt).lastInsertRowid;
  insertActivity.run(id, manager, 'created', 'New', 'seeded', createdAt);
}

db.prepare(
  'INSERT INTO site_visits (lead_id, agent_id, project_id, scheduled_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
).run(3, agent2, p2, nowIST().slice(0, 11) + '15:00:00+05:30', 'scheduled', now, now);

console.log('demo data seeded. logins (password: demo-password-123):');
console.log('  owner@demo.crm / manager@demo.crm / ravi@demo.crm / deepa@demo.crm');
console.log(`users: owner=${owner} manager=${manager} agents=${agent1},${agent2}`);
