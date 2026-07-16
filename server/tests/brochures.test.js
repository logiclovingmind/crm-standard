import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestEnv, seedUser, loginAgent } from './helpers.js';

setupTestEnv('brochures');
process.env.WHATSAPP_BOT_TOKEN = 'bot-secret-test';

const { createApp } = await import('../index.js');
const { getDb } = await import('../db.js');

const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('demo brochure body'), Buffer.from('\n%%EOF')]);

let app, owner, projectId;

beforeAll(async () => {
  app = createApp();
  getDb();
  seedUser(getDb(), { name: 'Owner', email: 'owner@b.crm', role: 'owner' });
  owner = await loginAgent(app, 'owner@b.crm');
  const res = await owner
    .post('/api/inventory/projects')
    .set('x-csrf-token', owner.csrfToken)
    .send({ name: 'Skyline Heights', location: 'Whitefield' });
  projectId = res.body.id;
});

describe('brochure upload', () => {
  it('rejects a non-PDF payload', async () => {
    const res = await owner
      .post(`/api/inventory/projects/${projectId}/brochure`)
      .set('x-csrf-token', owner.csrfToken)
      .set('content-type', 'application/pdf')
      .set('x-filename', 'notes.txt')
      .send(Buffer.from('just some text, not a pdf'));
    expect(res.status).toBe(400);
  });

  it('accepts a PDF and records the display filename', async () => {
    const res = await owner
      .post(`/api/inventory/projects/${projectId}/brochure`)
      .set('x-csrf-token', owner.csrfToken)
      .set('content-type', 'application/pdf')
      .set('x-filename', 'Skyline Heights Brochure.pdf')
      .send(PDF);
    expect(res.status).toBe(200);
    expect(res.body.filename).toBe('Skyline Heights Brochure.pdf');
    const row = getDb().prepare('SELECT brochure_filename FROM projects WHERE id = ?').get(projectId);
    expect(row.brochure_filename).toBe('Skyline Heights Brochure.pdf');
  });
});

describe('public brochure download', () => {
  it('serves the PDF without auth', async () => {
    const res = await request(app).get(`/brochures/${projectId}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('404s for a project without a brochure', async () => {
    const res = await request(app).get('/brochures/99999');
    expect(res.status).toBe(404);
  });
});

describe('agent brochure catalog', () => {
  it('lists uploaded brochures with a public url for the bot', async () => {
    const res = await request(app)
      .get('/api/integrations/whatsapp/brochures')
      .set('authorization', 'Bearer bot-secret-test');
    expect(res.status).toBe(200);
    expect(res.body.brochures).toHaveLength(1);
    expect(res.body.brochures[0].project).toBe('Skyline Heights');
    expect(res.body.brochures[0].url).toMatch(new RegExp(`/brochures/${projectId}$`));
  });

  it('rejects a missing bot token', async () => {
    const res = await request(app).get('/api/integrations/whatsapp/brochures');
    expect(res.status).toBe(401);
  });
});
