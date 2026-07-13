import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestEnv, seedUser, seedLead, loginAgent } from './helpers.js';

setupTestEnv('roles');

import { createApp } from '../index.js';
import { getDb } from '../db.js';

let app, db;
let ownerId, managerId, agent1Id, agent2Id;
let lead1Id, lead2Id, unassignedId;
let owner, manager, agent1;

beforeAll(async () => {
  app = createApp();
  db = getDb();
  ownerId = seedUser(db, { name: 'Owner', email: 'owner@t.crm', role: 'owner' });
  managerId = seedUser(db, { name: 'Manager', email: 'manager@t.crm', role: 'manager' });
  agent1Id = seedUser(db, { name: 'Agent One', email: 'a1@t.crm', role: 'agent' });
  agent2Id = seedUser(db, { name: 'Agent Two', email: 'a2@t.crm', role: 'agent' });
  lead1Id = seedLead(db, { name: 'Lead For A1', phone: '+919800000001', assignedTo: agent1Id });
  lead2Id = seedLead(db, { name: 'Lead For A2', phone: '+919800000002', assignedTo: agent2Id });
  unassignedId = seedLead(db, { name: 'Unassigned Lead', phone: '+919800000003' });

  owner = await loginAgent(app, 'owner@t.crm');
  manager = await loginAgent(app, 'manager@t.crm');
  agent1 = await loginAgent(app, 'a1@t.crm');
});

describe('lead list scoping', () => {
  it('agent sees only their own leads', async () => {
    const res = await agent1.get('/api/leads');
    expect(res.status).toBe(200);
    expect(res.body.leads.map((l) => l.id)).toEqual([lead1Id]);
  });

  it('manager sees all leads', async () => {
    const res = await manager.get('/api/leads');
    expect(res.status).toBe(200);
    expect(res.body.leads).toHaveLength(3);
  });

  it('owner sees all leads', async () => {
    const res = await owner.get('/api/leads');
    expect(res.body.leads).toHaveLength(3);
  });

  it('agent cannot bypass scope with assigned_to filter', async () => {
    const res = await agent1.get(`/api/leads?assigned_to=${agent2Id}`);
    expect(res.body.leads.map((l) => l.id)).toEqual([lead1Id]);
  });
});

describe('lead detail scoping', () => {
  it("agent gets 404 for another agent's lead", async () => {
    const res = await agent1.get(`/api/leads/${lead2Id}`);
    expect(res.status).toBe(404);
  });

  it('agent gets 404 for unassigned leads', async () => {
    const res = await agent1.get(`/api/leads/${unassignedId}`);
    expect(res.status).toBe(404);
  });

  it('agent can read their own lead', async () => {
    const res = await agent1.get(`/api/leads/${lead1Id}`);
    expect(res.status).toBe(200);
    expect(res.body.lead.id).toBe(lead1Id);
  });

  it("agent cannot update another agent's lead", async () => {
    const res = await agent1
      .put(`/api/leads/${lead2Id}`)
      .set('x-csrf-token', agent1.csrfToken)
      .send({ status: 'Contacted' });
    expect(res.status).toBe(404);
    expect(db.prepare('SELECT status FROM leads WHERE id = ?').get(lead2Id).status).toBe('New');
  });

  it("agent cannot add a note to another agent's lead", async () => {
    const res = await agent1
      .post(`/api/leads/${lead2Id}/notes`)
      .set('x-csrf-token', agent1.csrfToken)
      .send({ body: 'sneaky note' });
    expect(res.status).toBe(404);
  });
});

describe('role-gated actions', () => {
  it('agent cannot reassign leads', async () => {
    const res = await agent1
      .put(`/api/leads/${lead1Id}/assign`)
      .set('x-csrf-token', agent1.csrfToken)
      .send({ assigned_to: agent2Id });
    expect(res.status).toBe(403);
  });

  it('manager can reassign leads', async () => {
    const res = await manager
      .put(`/api/leads/${unassignedId}/assign`)
      .set('x-csrf-token', manager.csrfToken)
      .send({ assigned_to: agent1Id });
    expect(res.status).toBe(200);
  });

  it('agent-created leads are forced to self-assignment', async () => {
    const res = await agent1
      .post('/api/leads')
      .set('x-csrf-token', agent1.csrfToken)
      .send({ name: 'Walk In', phone: '9800000009', source: 'walk-in', assigned_to: agent2Id });
    expect(res.status).toBe(201);
    expect(db.prepare('SELECT assigned_to FROM leads WHERE id = ?').get(res.body.id).assigned_to).toBe(agent1Id);
  });

  it('export is owner-only', async () => {
    expect((await agent1.get('/api/export/leads.xlsx')).status).toBe(403);
    expect((await manager.get('/api/export/leads.xlsx')).status).toBe(403);
    expect((await owner.get('/api/export/leads.xlsx')).status).toBe(200);
  });

  it('user management is owner-only', async () => {
    expect((await manager.get('/api/users')).status).toBe(403);
    expect((await owner.get('/api/users')).status).toBe(200);
    expect((await manager.get('/api/users/assignable')).status).toBe(200);
    expect((await agent1.get('/api/users/assignable')).status).toBe(403);
  });

  it('mutations without csrf token are rejected', async () => {
    const res = await agent1.post(`/api/leads/${lead1Id}/notes`).send({ body: 'no csrf' });
    expect(res.status).toBe(403);
  });

  it('unauthenticated requests are rejected', async () => {
    expect((await request(app).get('/api/leads')).status).toBe(401);
  });
});

describe('stale lead scoping', () => {
  it('agent stale list only contains own leads', async () => {
    const old = '2026-01-01T00:00:00+05:30';
    db.prepare('UPDATE leads SET created_at = ?, updated_at = ? WHERE id IN (?, ?)').run(old, old, lead1Id, lead2Id);
    db.prepare('DELETE FROM lead_activity WHERE lead_id IN (?, ?)').run(lead1Id, lead2Id);

    const agentRes = await agent1.get('/api/dashboard/stale');
    expect(agentRes.body.leads.map((l) => l.id)).toEqual([lead1Id]);

    const managerRes = await manager.get('/api/dashboard/stale');
    const ids = managerRes.body.leads.map((l) => l.id);
    expect(ids).toContain(lead1Id);
    expect(ids).toContain(lead2Id);
  });
});
