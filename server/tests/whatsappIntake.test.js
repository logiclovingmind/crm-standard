import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestEnv } from './helpers.js';

setupTestEnv('intake');
process.env.WHATSAPP_BOT_TOKEN = 'test-bot-token';

import { createApp } from '../index.js';
import { getDb } from '../db.js';

const ENDPOINT = '/api/integrations/whatsapp/lead';
const payload = {
  name: 'Anil Sharma',
  phone: '+919845099001',
  source: 'whatsapp',
  requirement: '2BHK, Whitefield, budget 80L',
  conversation_summary: 'Asked about Brigade Meadows',
  site_visit_requested: false,
};

let app, db;

beforeAll(() => {
  app = createApp();
  db = getDb();
});

function post(body, token = 'test-bot-token') {
  const req = request(app).post(ENDPOINT);
  if (token) req.set('authorization', `Bearer ${token}`);
  return req.send(body);
}

describe('auth', () => {
  it('rejects missing token', async () => {
    expect((await post(payload, null)).status).toBe(401);
  });

  it('rejects wrong token', async () => {
    expect((await post(payload, 'wrong-token')).status).toBe(401);
  });
});

describe('dedupe on phone number', () => {
  it('creates a new lead on first contact', async () => {
    const res = await post(payload);
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(res.body.lead_id);
    expect(lead.phone).toBe('+919845099001');
    expect(lead.status).toBe('New');
  });

  it('appends activity to the existing open lead instead of duplicating', async () => {
    const dedupePayload = { ...payload, phone: '+919845099010' };
    const first = await post(dedupePayload);
    const second = await post({ ...dedupePayload, conversation_summary: 'Follow-up question about pricing' });
    expect(second.status).toBe(200);
    expect(second.body.created).toBe(false);
    expect(second.body.lead_id).toBe(first.body.lead_id);

    const count = db.prepare('SELECT COUNT(*) AS n FROM leads WHERE phone = ?').get(dedupePayload.phone).n;
    expect(count).toBe(1);
    const activity = db
      .prepare("SELECT * FROM lead_activity WHERE lead_id = ? AND type = 'whatsapp_intake'")
      .all(first.body.lead_id);
    expect(activity).toHaveLength(1);
    expect(activity[0].detail).toBe('Follow-up question about pricing');
  });

  it('normalizes phone formats when deduping', async () => {
    const first = await post({ ...payload, phone: '+919845099002' });
    const second = await post({ ...payload, phone: '98450 99002' });
    expect(second.body.lead_id).toBe(first.body.lead_id);
    expect(second.body.created).toBe(false);
  });

  it('creates a fresh lead when the existing one is Closed/Lost', async () => {
    const first = await post({ ...payload, phone: '+919845099003' });
    db.prepare("UPDATE leads SET status = 'Closed' WHERE id = ?").run(first.body.lead_id);
    const second = await post({ ...payload, phone: '+919845099003' });
    expect(second.status).toBe(201);
    expect(second.body.created).toBe(true);
    expect(second.body.lead_id).not.toBe(first.body.lead_id);
  });
});

describe('site visit requests', () => {
  it('creates a site visit when requested with a slot', async () => {
    const res = await post({
      ...payload,
      phone: '+919845099004',
      site_visit_requested: true,
      preferred_slot: '2026-07-15T11:00:00+05:30',
    });
    expect(res.body.visit_id).toBeTruthy();
    const visit = db.prepare('SELECT * FROM site_visits WHERE id = ?').get(res.body.visit_id);
    expect(visit.lead_id).toBe(res.body.lead_id);
    expect(visit.scheduled_at).toBe('2026-07-15T11:00:00+05:30');
    expect(visit.status).toBe('scheduled');
  });
});

describe('validation', () => {
  it('rejects invalid phone', async () => {
    expect((await post({ ...payload, phone: '12345' })).status).toBe(400);
  });

  it('rejects missing name', async () => {
    expect((await post({ ...payload, name: '' })).status).toBe(400);
  });
});
