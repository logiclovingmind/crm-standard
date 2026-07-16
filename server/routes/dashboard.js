const express = require('express');
const { getDb } = require('../db');
const { istHoursAgo, istMonthPrefix } = require('../lib/time');
const { scopeLeadsToUser } = require('../middleware/auth');
const { getBackupStatus } = require('../services/backup');

const STALE_HOURS = 72;

const router = express.Router();
router.use(scopeLeadsToUser);

function staleLeads(db, scope) {
  let sql = `SELECT l.id, l.name, l.phone, l.status, l.assigned_to, u.name AS assigned_name,
                    COALESCE(MAX(a.created_at), l.created_at) AS last_activity
             FROM leads l
             LEFT JOIN lead_activity a ON a.lead_id = l.id
             LEFT JOIN users u ON u.id = l.assigned_to
             WHERE l.status IN ('New', 'Contacted', 'Site Visit')`;
  const params = [];
  if (scope) {
    sql += ' AND l.assigned_to = ?';
    params.push(scope);
  }
  sql += ' GROUP BY l.id HAVING last_activity < ? ORDER BY last_activity ASC';
  params.push(istHoursAgo(STALE_HOURS));
  return db.prepare(sql).all(...params);
}

router.get('/summary', (req, res) => {
  const db = getDb();
  const scope = req.leadScope;
  const scopeSql = scope ? ' AND assigned_to = ?' : '';
  const scopeParams = scope ? [scope] : [];

  const thisMonth = db
    .prepare(`SELECT COUNT(*) AS n FROM leads WHERE created_at LIKE ?${scopeSql}`)
    .get(istMonthPrefix(0) + '%', ...scopeParams).n;
  const lastMonth = db
    .prepare(`SELECT COUNT(*) AS n FROM leads WHERE created_at LIKE ?${scopeSql}`)
    .get(istMonthPrefix(1) + '%', ...scopeParams).n;

  // Per-source: total leads, how many closed, and the conversion % — the
  // renewal-justifying view of "which channel actually produces deals".
  const sources = db
    .prepare(
      `SELECT source,
              COUNT(*) AS n,
              SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS closed
       FROM leads WHERE 1=1${scopeSql} GROUP BY source ORDER BY n DESC`
    )
    .all(...scopeParams)
    .map((s) => ({
      ...s,
      conversion: s.n ? Math.round((s.closed / s.n) * 1000) / 10 : 0,
    }));
  const funnel = db
    .prepare(`SELECT status, COUNT(*) AS n FROM leads WHERE 1=1${scopeSql} GROUP BY status`)
    .all(...scopeParams);

  // Deals closed THIS month, timed by the status-change activity (not lead
  // creation — a deal closes long after the lead arrives). Only count leads
  // still Closed now, so a closed-then-reopened lead doesn't inflate revenue.
  const closedScopeSql = scope ? ' AND l.assigned_to = ?' : '';
  const closedThisMonth = db
    .prepare(
      `WITH closed_ids AS (
         SELECT DISTINCT lead_id FROM lead_activity
         WHERE type = 'status_change' AND to_status = 'Closed' AND created_at LIKE ?
       )
       SELECT COUNT(*) AS deals, COALESCE(SUM(l.deal_value), 0) AS revenue
       FROM closed_ids c JOIN leads l ON l.id = c.lead_id
       WHERE l.status = 'Closed'${closedScopeSql}`
    )
    .get(istMonthPrefix(0) + '%', ...scopeParams);

  const stale = staleLeads(db, scope);

  const summary = {
    leadsThisMonth: thisMonth,
    leadsLastMonth: lastMonth,
    sources,
    funnel,
    closedThisMonth,
    staleCount: stale.length,
  };
  if (req.session.user.role === 'owner') summary.backup = getBackupStatus();
  res.json(summary);
});

router.get('/stale', (req, res) => {
  res.json({ leads: staleLeads(getDb(), req.leadScope) });
});

module.exports = router;
