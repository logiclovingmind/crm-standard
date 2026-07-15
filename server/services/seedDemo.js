// Demo brokerage data for sales demos. Populates a realistic, "in full use"
// CRM: owner + manager + 2 agents, 2 projects with units, 30 leads spread
// across every status/source/agent, activity history, notes, and site visits.
//
// Used two ways:
//   1. scripts/seed-demo.js — manual CLI seed (refuses if leads already exist).
//   2. server/index.js on boot — auto-seed when DEMO_SEED=1 and DB is empty,
//      so Render's ephemeral free tier comes up fully populated after a wipe.
const bcrypt = require('bcrypt');
const { nowIST, istHoursAgo } = require('../lib/time');

const DEMO_PASSWORD = 'demo-password-123';

// [name, phone, source, status, requirement, agentSlot(1|2), hoursAgo]
const LEADS = [
  ['Anil Sharma', '+919845010001', 'whatsapp', 'New', '2BHK, Whitefield, budget 80L', 1, 100],
  ['Meera Nair', '+919845010002', 'whatsapp', 'Contacted', '3BHK, budget 1.2Cr', 1, 20],
  ['Suresh Gowda', '+919845010003', '99acres', 'Site Visit', 'Plot in Sarjapur', 2, 80],
  ['Farah Khan', '+919845010004', 'walk-in', 'Negotiation', '2BHK ready to move', 2, 5],
  ['Vikram Patil', '+919845010005', 'referral', 'Closed', 'Plot, closed at 60L', 1, 300],
  ['Lakshmi Iyer', '+919845010006', 'magicbricks', 'Lost', 'Wanted villa, over budget', 2, 400],
  ['Rahul Verma', '+919845010007', 'whatsapp', 'New', '2BHK Sarjapur, budget 75L', 1, 3],
  ['Priya Menon', '+919845010008', '99acres', 'Contacted', '3BHK Whitefield', 2, 12],
  ['Karthik Reddy', '+919845010009', 'whatsapp', 'New', 'Plot, BMRDA approved', 1, 8],
  ['Sneha Joshi', '+919845010010', 'magicbricks', 'Contacted', '2BHK ready to move, budget 90L', 2, 30],
  ['Arjun Nair', '+919845010011', 'referral', 'Site Visit', '3BHK Brigade Meadows', 1, 48],
  ['Divya Rao', '+919845010012', 'whatsapp', 'New', '1BHK for investment', 2, 2],
  ['Manish Agarwal', '+919845010013', 'walk-in', 'Negotiation', '3BHK, budget 1.1Cr', 1, 15],
  ['Pooja Shetty', '+919845010014', '99acres', 'Contacted', '2BHK Sarjapur', 2, 40],
  ['Sanjay Kulkarni', '+919845010015', 'whatsapp', 'New', 'Plot 1500 sqft', 1, 6],
  ['Neha Kapoor', '+919845010016', 'magicbricks', 'Site Visit', '3BHK ready to move', 2, 55],
  ['Ganesh Bhat', '+919845010017', 'referral', 'Closed', '2BHK closed at 82L', 1, 260],
  ['Ritu Malhotra', '+919845010018', 'whatsapp', 'New', 'Villa, budget 2Cr', 2, 4],
  ['Aditya Rao', '+919845010019', '99acres', 'Contacted', '2BHK Whitefield', 1, 26],
  ['Kavya Pillai', '+919845010020', 'whatsapp', 'New', 'Plot Sarjapur, investment', 2, 9],
  ['Deepak Hegde', '+919845010021', 'walk-in', 'Site Visit', '3BHK Brigade Meadows', 1, 70],
  ['Ananya Das', '+919845010022', 'magicbricks', 'Lost', 'Budget too low for area', 2, 350],
  ['Rohan Mehta', '+919845010023', 'whatsapp', 'New', '2BHK, budget 70L', 1, 1],
  ['Shwetha Rai', '+919845010024', 'referral', 'Negotiation', '3BHK, budget 1.3Cr', 2, 18],
  ['Naveen Kumar', '+919845010025', '99acres', 'Contacted', 'Plot, BMRDA approved', 1, 33],
  ['Ishita Sen', '+919845010026', 'whatsapp', 'New', '1BHK Whitefield, rent', 2, 7],
  ['Prakash Jain', '+919845010027', 'magicbricks', 'Closed', 'Plot closed at 55L', 1, 220],
  ['Tara Krishnan', '+919845010028', 'whatsapp', 'New', '2BHK ready to move', 2, 5],
  ['Varun Shetty', '+919845010029', 'walk-in', 'Contacted', '3BHK Sarjapur', 1, 22],
  ['Nisha Reddy', '+919845010030', 'referral', 'Site Visit', '2BHK Brigade Meadows', 2, 60],
];

// A few notes for realism, keyed by lead phone.
const NOTES = {
  '+919845010004': 'Very keen, wants to close this week. Discussing final price.',
  '+919845010011': 'Site visit done, liked B-block. Following up on loan eligibility.',
  '+919845010013': 'Negotiating on 3BHK. Comparing with a competitor project.',
  '+919845010024': 'Wants corner unit. Awaiting availability confirmation.',
};

function seedDemoData(db, { silent = false } = {}) {
  const now = nowIST();
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 12);
  const log = silent ? () => {} : (...a) => console.log(...a);

  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const owner = insertUser.run('Prakash Rao', 'owner@demo.crm', hash, 'owner', now, now).lastInsertRowid;
  const manager = insertUser.run('Sunita Hegde', 'manager@demo.crm', hash, 'manager', now, now).lastInsertRowid;
  const agent1 = insertUser.run('Ravi Kumar', 'ravi@demo.crm', hash, 'agent', now, now).lastInsertRowid;
  const agent2 = insertUser.run('Deepa Shetty', 'deepa@demo.crm', hash, 'agent', now, now).lastInsertRowid;
  const agents = { 1: agent1, 2: agent2 };

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
  const insertNote = db.prepare(
    'INSERT INTO lead_notes (lead_id, user_id, body, created_at) VALUES (?, ?, ?, ?)'
  );

  const leadIdByPhone = {};
  for (const [name, phone, source, status, req, slot, hoursAgo] of LEADS) {
    const assignee = agents[slot];
    const createdAt = istHoursAgo(hoursAgo);
    const id = insertLead.run(name, phone, source, status, req, assignee, createdAt, createdAt).lastInsertRowid;
    leadIdByPhone[phone] = id;
    insertActivity.run(id, manager, 'created', 'New', 'seeded', createdAt);
    if (status !== 'New') {
      insertActivity.run(id, assignee, 'status_change', status, `moved to ${status}`, istHoursAgo(Math.floor(hoursAgo / 2)));
    }
    if (NOTES[phone]) insertNote.run(id, assignee, NOTES[phone], istHoursAgo(Math.floor(hoursAgo / 3)));
  }

  // Upcoming site visits for leads currently at the "Site Visit" stage.
  const insertVisit = db.prepare(
    'INSERT INTO site_visits (lead_id, agent_id, project_id, scheduled_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const visits = [
    ['+919845010003', agent2, p2, istHoursAgo(-24)],
    ['+919845010011', agent1, p1, istHoursAgo(-3)],
    ['+919845010016', agent2, p1, istHoursAgo(-48)],
    ['+919845010021', agent1, p1, istHoursAgo(-27)],
    ['+919845010030', agent2, p1, istHoursAgo(-5)],
  ];
  for (const [phone, agentId, projectId, scheduledAt] of visits) {
    insertVisit.run(leadIdByPhone[phone], agentId, projectId, scheduledAt, 'scheduled', now, now);
  }

  log(`demo data seeded: ${LEADS.length} leads, 4 users, 2 projects, 5 units, ${visits.length} visits`);
  log(`logins (password: ${DEMO_PASSWORD}): owner@demo.crm / manager@demo.crm / ravi@demo.crm / deepa@demo.crm`);
  return { owner, manager, agent1, agent2 };
}

module.exports = { seedDemoData, DEMO_PASSWORD };
