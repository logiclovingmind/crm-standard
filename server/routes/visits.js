const express = require('express');
const { getDb } = require('../db');
const { nowIST } = require('../lib/time');
const { scopeLeadsToUser } = require('../middleware/auth');
const calendar = require('../services/calendar');

const VISIT_STATUSES = ['scheduled', 'completed', 'no-show', 'cancelled'];

const router = express.Router();
router.use(scopeLeadsToUser);

router.get('/', (req, res) => {
  let sql = `SELECT v.*, l.name AS lead_name, l.phone AS lead_phone, u.name AS agent_name,
                    p.name AS project_name, un.identifier AS unit_identifier
             FROM site_visits v
             JOIN leads l ON l.id = v.lead_id
             LEFT JOIN users u ON u.id = v.agent_id
             LEFT JOIN projects p ON p.id = v.project_id
             LEFT JOIN units un ON un.id = v.unit_id
             WHERE 1=1`;
  const params = [];
  if (req.leadScope) {
    sql += ' AND v.agent_id = ?';
    params.push(req.leadScope);
  }
  if (req.query.status && VISIT_STATUSES.includes(req.query.status)) {
    sql += ' AND v.status = ?';
    params.push(req.query.status);
  }
  sql += ' ORDER BY v.scheduled_at DESC LIMIT 500';
  res.json({ visits: getDb().prepare(sql).all(...params) });
});

router.post('/', (req, res) => {
  const { lead_id, scheduled_at, project_id, unit_id, agent_id } = req.body || {};
  const db = getDb();
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(lead_id);
  if (!lead || (req.leadScope && lead.assigned_to !== req.leadScope)) {
    return res.status(404).json({ error: 'lead not found' });
  }
  if (!scheduled_at || typeof scheduled_at !== 'string') {
    return res.status(400).json({ error: 'scheduled_at required' });
  }
  // Agents can only schedule visits for themselves.
  const agent = req.leadScope ? req.leadScope : agent_id || lead.assigned_to || null;

  const now = nowIST();
  const visitId = db.transaction(() => {
    const info = db
      .prepare(
        'INSERT INTO site_visits (lead_id, agent_id, project_id, unit_id, scheduled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(lead.id, agent, project_id || null, unit_id || null, scheduled_at, now, now);
    db.prepare(
      'INSERT INTO lead_activity (lead_id, user_id, type, detail, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(lead.id, req.session.user.id, 'site_visit_scheduled', `visit ${info.lastInsertRowid} at ${scheduled_at}`, now);
    db.prepare('UPDATE leads SET updated_at = ? WHERE id = ?').run(now, lead.id);
    return info.lastInsertRowid;
  })();

  res.status(201).json({ id: visitId });
  calendar.onVisitCreated(visitId); // fire-and-forget, after response
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const visit = db.prepare('SELECT * FROM site_visits WHERE id = ?').get(req.params.id);
  if (!visit || (req.leadScope && visit.agent_id !== req.leadScope)) {
    return res.status(404).json({ error: 'not found' });
  }
  const { status, scheduled_at } = req.body || {};
  if (status !== undefined && !VISIT_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  const now = nowIST();
  db.transaction(() => {
    db.prepare('UPDATE site_visits SET status = ?, scheduled_at = ?, updated_at = ? WHERE id = ?').run(
      status ?? visit.status,
      scheduled_at ?? visit.scheduled_at,
      now,
      visit.id
    );
    if (status && status !== visit.status) {
      db.prepare(
        'INSERT INTO lead_activity (lead_id, user_id, type, detail, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(visit.lead_id, req.session.user.id, 'site_visit_' + status.replace('-', '_'), `visit ${visit.id}`, now);
    }
  })();

  res.json({ ok: true });
  if (status === 'cancelled') calendar.onVisitCancelled(visit.id);
  else calendar.onVisitUpdated(visit.id);
});

module.exports = router;
