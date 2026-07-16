import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnv, seedUser, seedLead, loginAgent } from './helpers.js';

setupTestEnv('revenue');

import { createApp } from '../index.js';
import { getDb } from '../db.js';

let app, db, owner, agent1;
let ownerId, agent1Id, agent2Id;

// Close a lead (logs the status_change activity this month) and set its deal
// value, through the real PUT route so validation + activity logging are covered.
async function closeWithValue(agent, id, value) {
  const res = await agent
    .put(`/api/leads/${id}`)
    .set('x-csrf-token', agent.csrfToken)
    .send({ status: 'Closed', deal_value: value });
  expect(res.status).toBe(200);
}

beforeAll(async () => {
  app = createApp();
  db = getDb();
  ownerId = seedUser(db, { name: 'Owner', email: 'owner@r.crm', role: 'owner' });
  agent1Id = seedUser(db, { name: 'Agent One', email: 'a1@r.crm', role: 'agent' });
  agent2Id = seedUser(db, { name: 'Agent Two', email: 'a2@r.crm', role: 'agent' });

  // whatsapp: 4 leads, 2 closed (one via agent1, one owner-closed unassigned-ish)
  const w1 = seedLead(db, { name: 'W1', phone: '+919800001001', source: 'whatsapp', assignedTo: agent1Id });
  const w2 = seedLead(db, { name: 'W2', phone: '+919800001002', source: 'whatsapp', assignedTo: agent1Id });
  seedLead(db, { name: 'W3', phone: '+919800001003', source: 'whatsapp', assignedTo: agent1Id });
  seedLead(db, { name: 'W4', phone: '+919800001004', source: 'whatsapp', assignedTo: agent2Id });
  // walk-in: 2 leads, none closed
  seedLead(db, { name: 'K1', phone: '+919800002001', source: 'walk-in', assignedTo: agent2Id });
  seedLead(db, { name: 'K2', phone: '+919800002002', source: 'walk-in', assignedTo: agent2Id });

  owner = await loginAgent(app, 'owner@r.crm');
  agent1 = await loginAgent(app, 'a1@r.crm');

  await closeWithValue(agent1, w1, 8500000); // 85 L
  await closeWithValue(agent1, w2, null); // closed, value not entered yet
});

describe('deal_value validation', () => {
  it('rejects a negative deal value', async () => {
    const res = await owner
      .put('/api/leads/1')
      .set('x-csrf-token', owner.csrfToken)
      .send({ deal_value: -5 });
    expect(res.status).toBe(400);
  });

  it('persists a set deal value', async () => {
    const row = db.prepare("SELECT deal_value FROM leads WHERE phone = '+919800001001'").get();
    expect(row.deal_value).toBe(8500000);
  });
});

describe('dashboard summary — source conversion', () => {
  it('reports per-source conversion %', async () => {
    const res = await owner.get('/api/dashboard/summary');
    const bySource = Object.fromEntries(res.body.sources.map((s) => [s.source, s]));
    // whatsapp: 2 of 4 closed = 50%
    expect(bySource.whatsapp.n).toBe(4);
    expect(bySource.whatsapp.closed).toBe(2);
    expect(bySource.whatsapp.conversion).toBe(50);
    // walk-in: 0 of 2 = 0%
    expect(bySource['walk-in'].conversion).toBe(0);
  });
});

describe('dashboard summary — revenue this month', () => {
  it('sums deal_value across leads closed this month for the owner', async () => {
    const res = await owner.get('/api/dashboard/summary');
    expect(res.body.closedThisMonth.deals).toBe(2); // both closes counted
    expect(res.body.closedThisMonth.revenue).toBe(8500000); // null-value close adds 0
  });

  it('scopes revenue to the agent\'s own closed leads', async () => {
    const res = await agent1.get('/api/dashboard/summary');
    // agent1 owns both closed leads, so sees the same figures
    expect(res.body.closedThisMonth.deals).toBe(2);
    expect(res.body.closedThisMonth.revenue).toBe(8500000);
  });
});
