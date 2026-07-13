const { getDb } = require('../db');
const { nowIST } = require('../lib/time');
const { normalizePhone } = require('../lib/phone');

const SOURCES = ['whatsapp', 'walk-in', '99acres', 'magicbricks', 'referral', 'other'];

// Dedupe rule: if a lead with the same phone exists and is not Closed/Lost,
// append activity to it instead of creating a duplicate.
function intake(payload) {
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) return { error: 'name required' };
  const phone = normalizePhone(payload.phone);
  if (!phone) return { error: 'valid phone required' };
  const source = SOURCES.includes(payload.source) ? payload.source : 'whatsapp';

  const db = getDb();
  const now = nowIST();

  return db.transaction(() => {
    const existing = db
      .prepare("SELECT * FROM leads WHERE phone = ? AND status NOT IN ('Closed', 'Lost') ORDER BY id DESC LIMIT 1")
      .get(phone);

    let leadId;
    let created;
    if (existing) {
      leadId = existing.id;
      created = false;
      db.prepare(
        'INSERT INTO lead_activity (lead_id, type, detail, created_at) VALUES (?, ?, ?, ?)'
      ).run(leadId, 'whatsapp_intake', payload.conversation_summary || payload.requirement || 'repeat contact', now);
      db.prepare('UPDATE leads SET updated_at = ? WHERE id = ?').run(now, leadId);
    } else {
      const info = db
        .prepare(
          `INSERT INTO leads (name, phone, source, requirement, conversation_summary, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(name, phone, source, payload.requirement || null, payload.conversation_summary || null, now, now);
      leadId = info.lastInsertRowid;
      created = true;
      db.prepare(
        'INSERT INTO lead_activity (lead_id, type, to_status, detail, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(leadId, 'created', 'New', 'via WhatsApp bot', now);
    }

    let visitId = null;
    if (payload.site_visit_requested && typeof payload.preferred_slot === 'string' && payload.preferred_slot) {
      const lead = db.prepare('SELECT assigned_to FROM leads WHERE id = ?').get(leadId);
      const info = db
        .prepare(
          'INSERT INTO site_visits (lead_id, agent_id, scheduled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(leadId, lead.assigned_to ?? null, payload.preferred_slot, now, now);
      visitId = info.lastInsertRowid;
      db.prepare(
        'INSERT INTO lead_activity (lead_id, type, detail, created_at) VALUES (?, ?, ?, ?)'
      ).run(leadId, 'site_visit_scheduled', `visit ${visitId} at ${payload.preferred_slot} (via bot)`, now);
    }

    return { leadId, created, visitId };
  })();
}

module.exports = { intake };
