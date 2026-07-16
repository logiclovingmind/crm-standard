const express = require('express');
const { getDb } = require('../db');
const { nowIST } = require('../lib/time');
const { normalizePhone } = require('../lib/phone');
const { requireRole, scopeLeadsToUser } = require('../middleware/auth');

const STATUSES = ['New', 'Contacted', 'Site Visit', 'Negotiation', 'Closed', 'Lost'];
const SOURCES = ['whatsapp', 'walk-in', '99acres', 'magicbricks', 'referral', 'other'];

const router = express.Router();
router.use(scopeLeadsToUser);

// Returns the lead only if the requester is allowed to see it. Agents get 404
// (not 403) for other agents' leads so lead existence is not leaked.
function getLeadScoped(req, res) {
  const lead = getDb().prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead || (req.leadScope && lead.assigned_to !== req.leadScope)) {
    res.status(404).json({ error: 'not found' });
    return null;
  }
  return lead;
}

function logActivity(db, { leadId, userId = null, type, fromStatus = null, toStatus = null, detail = null }) {
  db.prepare(
    'INSERT INTO lead_activity (lead_id, user_id, type, from_status, to_status, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(leadId, userId, type, fromStatus, toStatus, detail, nowIST());
}

router.get('/', (req, res) => {
  const db = getDb();
  let sql = `SELECT l.*, u.name AS assigned_name
             FROM leads l LEFT JOIN users u ON u.id = l.assigned_to
             WHERE 1=1`;
  const params = [];

  if (req.leadScope) {
    sql += ' AND l.assigned_to = ?';
    params.push(req.leadScope);
  }
  const { q, status, source, assigned_to, from, to } = req.query;
  if (q) {
    sql += ' AND (l.name LIKE ? OR l.phone LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  if (status && STATUSES.includes(status)) {
    sql += ' AND l.status = ?';
    params.push(status);
  }
  if (source && SOURCES.includes(source)) {
    sql += ' AND l.source = ?';
    params.push(source);
  }
  if (assigned_to && !req.leadScope) {
    sql += ' AND l.assigned_to = ?';
    params.push(assigned_to);
  }
  if (from) {
    sql += ' AND l.created_at >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND l.created_at <= ?';
    params.push(to + 'T23:59:59+05:30');
  }
  sql += ' ORDER BY l.updated_at DESC LIMIT 500';
  res.json({ leads: db.prepare(sql).all(...params) });
});

router.post('/', (req, res) => {
  const { name, phone, source, requirement, assigned_to } = req.body || {};
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
  const normPhone = normalizePhone(phone);
  if (!normPhone) return res.status(400).json({ error: 'valid Indian phone number required' });
  if (!SOURCES.includes(source)) return res.status(400).json({ error: 'invalid source' });

  // Agents can only create leads assigned to themselves.
  const assignee = req.leadScope ? req.leadScope : assigned_to || null;

  const db = getDb();
  const now = nowIST();
  const result = db.transaction(() => {
    const info = db
      .prepare(
        'INSERT INTO leads (name, phone, source, requirement, assigned_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(name.trim(), normPhone, source, requirement || null, assignee, now, now);
    logActivity(db, { leadId: info.lastInsertRowid, userId: req.session.user.id, type: 'created', toStatus: 'New' });
    return info.lastInsertRowid;
  })();
  res.status(201).json({ id: result });
});

router.get('/:id', (req, res) => {
  const lead = getLeadScoped(req, res);
  if (!lead) return;
  const db = getDb();
  const notes = db
    .prepare(
      `SELECT n.*, u.name AS author FROM lead_notes n JOIN users u ON u.id = n.user_id
       WHERE n.lead_id = ? ORDER BY n.created_at DESC`
    )
    .all(lead.id);
  const activity = db
    .prepare(
      `SELECT a.*, u.name AS user_name FROM lead_activity a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.lead_id = ? ORDER BY a.created_at DESC`
    )
    .all(lead.id);
  const units = db
    .prepare(
      `SELECT un.*, p.name AS project_name FROM lead_units lu
       JOIN units un ON un.id = lu.unit_id JOIN projects p ON p.id = un.project_id
       WHERE lu.lead_id = ?`
    )
    .all(lead.id);
  const visits = db
    .prepare(
      `SELECT v.*, u.name AS agent_name, p.name AS project_name FROM site_visits v
       LEFT JOIN users u ON u.id = v.agent_id LEFT JOIN projects p ON p.id = v.project_id
       WHERE v.lead_id = ? ORDER BY v.scheduled_at DESC`
    )
    .all(lead.id);
  const assignedName = lead.assigned_to
    ? db.prepare('SELECT name FROM users WHERE id = ?').get(lead.assigned_to)?.name
    : null;
  res.json({ lead: { ...lead, assigned_name: assignedName }, notes, activity, units, visits });
});

router.put('/:id', (req, res) => {
  const lead = getLeadScoped(req, res);
  if (!lead) return;
  const { name, phone, requirement, status, deal_value } = req.body || {};

  let normPhone = lead.phone;
  if (phone !== undefined) {
    normPhone = normalizePhone(phone);
    if (!normPhone) return res.status(400).json({ error: 'valid Indian phone number required' });
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }

  // deal_value: number >= 0 to set, null/'' to clear. Reject junk.
  let nextDealValue = lead.deal_value;
  if (deal_value !== undefined) {
    if (deal_value === null || deal_value === '') {
      nextDealValue = null;
    } else {
      const n = Number(deal_value);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'invalid deal_value' });
      nextDealValue = n;
    }
  }

  const db = getDb();
  db.transaction(() => {
    db.prepare(
      'UPDATE leads SET name = ?, phone = ?, requirement = ?, status = ?, deal_value = ?, updated_at = ? WHERE id = ?'
    ).run(
      typeof name === 'string' && name.trim() ? name.trim() : lead.name,
      normPhone,
      requirement !== undefined ? requirement : lead.requirement,
      status ?? lead.status,
      nextDealValue,
      nowIST(),
      lead.id
    );
    if (status && status !== lead.status) {
      logActivity(db, {
        leadId: lead.id,
        userId: req.session.user.id,
        type: 'status_change',
        fromStatus: lead.status,
        toStatus: status,
      });
    }
  })();
  res.json({ ok: true });
});

router.put('/:id/assign', requireRole('owner', 'manager'), (req, res) => {
  const db = getDb();
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'not found' });
  const { assigned_to } = req.body || {};
  if (assigned_to != null) {
    const target = db.prepare('SELECT id FROM users WHERE id = ? AND active = 1').get(assigned_to);
    if (!target) return res.status(400).json({ error: 'invalid assignee' });
  }
  db.transaction(() => {
    db.prepare('UPDATE leads SET assigned_to = ?, updated_at = ? WHERE id = ?').run(
      assigned_to ?? null,
      nowIST(),
      lead.id
    );
    logActivity(db, {
      leadId: lead.id,
      userId: req.session.user.id,
      type: 'assignment',
      detail: assigned_to ? `assigned to user ${assigned_to}` : 'unassigned',
    });
  })();
  res.json({ ok: true });
});

router.post('/:id/notes', (req, res) => {
  const lead = getLeadScoped(req, res);
  if (!lead) return;
  const { body } = req.body || {};
  if (!body || typeof body !== 'string' || !body.trim()) return res.status(400).json({ error: 'note body required' });
  const db = getDb();
  const now = nowIST();
  db.transaction(() => {
    db.prepare('INSERT INTO lead_notes (lead_id, user_id, body, created_at) VALUES (?, ?, ?, ?)').run(
      lead.id,
      req.session.user.id,
      body.trim(),
      now
    );
    logActivity(db, { leadId: lead.id, userId: req.session.user.id, type: 'note' });
    db.prepare('UPDATE leads SET updated_at = ? WHERE id = ?').run(now, lead.id);
  })();
  res.status(201).json({ ok: true });
});

router.post('/:id/units', (req, res) => {
  const lead = getLeadScoped(req, res);
  if (!lead) return;
  const { unit_id } = req.body || {};
  const db = getDb();
  const unit = db.prepare('SELECT id FROM units WHERE id = ?').get(unit_id);
  if (!unit) return res.status(400).json({ error: 'invalid unit' });
  db.prepare('INSERT OR IGNORE INTO lead_units (lead_id, unit_id, created_at) VALUES (?, ?, ?)').run(
    lead.id,
    unit.id,
    nowIST()
  );
  res.status(201).json({ ok: true });
});

router.delete('/:id/units/:unitId', (req, res) => {
  const lead = getLeadScoped(req, res);
  if (!lead) return;
  getDb().prepare('DELETE FROM lead_units WHERE lead_id = ? AND unit_id = ?').run(lead.id, req.params.unitId);
  res.json({ ok: true });
});

module.exports = router;
module.exports.STATUSES = STATUSES;
module.exports.SOURCES = SOURCES;
