// One-way CRM → Google Calendar sync via the shared Apps Script web app.
// No service account or googleapis dependency needed — reuses the same
// APPS_SCRIPT_WEBAPP_URL + APPS_SCRIPT_SHARED_SECRET the WhatsApp agent uses.
// Every entry point is fire-and-forget: a Calendar failure must never fail
// the CRM operation. Log and move on.
const { getDb } = require('../db');
const { nowIST } = require('../lib/time');

const RETRIES = 3;

function isEnabled() {
  return Boolean(process.env.APPS_SCRIPT_WEBAPP_URL && process.env.APPS_SCRIPT_SHARED_SECRET);
}

async function appsScriptCall(action, payload) {
  const url = process.env.APPS_SCRIPT_WEBAPP_URL;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, secret: process.env.APPS_SCRIPT_SHARED_SECRET, ...payload }),
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.reason || `Apps Script ${action} failed`);
  return data;
}

async function withRetry(label, fn) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === RETRIES) {
        console.error(`[calendar] ${label} failed after ${RETRIES} attempts:`, err.message);
        return null;
      }
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    }
  }
}

function loadVisit(visitId) {
  return getDb()
    .prepare(
      `SELECT v.*, l.name AS lead_name, l.phone AS lead_phone, u.name AS agent_name,
              p.name AS project_name, un.identifier AS unit_identifier
       FROM site_visits v
       JOIN leads l ON l.id = v.lead_id
       LEFT JOIN users u ON u.id = v.agent_id
       LEFT JOIN projects p ON p.id = v.project_id
       LEFT JOIN units un ON un.id = v.unit_id
       WHERE v.id = ?`
    )
    .get(visitId);
}

function buildEventPayload(visit) {
  const property = [visit.project_name, visit.unit_identifier].filter(Boolean).join(' / ');
  return {
    name: visit.lead_name,
    phone: visit.lead_phone,
    datetime: visit.scheduled_at,
    agent: visit.agent_name || undefined,
    property: property || undefined,
  };
}

function onVisitCreated(visitId) {
  if (!isEnabled()) return;
  withRetry(`create event for visit ${visitId}`, async () => {
    const visit = loadVisit(visitId);
    if (!visit || visit.status !== 'scheduled') return;
    const result = await appsScriptCall('create_event', { event: buildEventPayload(visit) });
    if (result?.event_id) {
      getDb()
        .prepare('UPDATE site_visits SET google_event_id = ?, updated_at = ? WHERE id = ?')
        .run(result.event_id, nowIST(), visitId);
    }
  });
}

function onVisitUpdated(visitId) {
  if (!isEnabled()) return;
  withRetry(`update event for visit ${visitId}`, async () => {
    const visit = loadVisit(visitId);
    if (!visit) return;
    if (!visit.google_event_id) return onVisitCreated(visitId);
    await appsScriptCall('update_event', {
      event: { ...buildEventPayload(visit), event_id: visit.google_event_id },
    });
  });
}

function onVisitCancelled(visitId) {
  if (!isEnabled()) return;
  withRetry(`cancel event for visit ${visitId}`, async () => {
    const visit = loadVisit(visitId);
    if (!visit?.google_event_id) return;
    await appsScriptCall('delete_event', { event_id: visit.google_event_id });
  });
}

module.exports = { onVisitCreated, onVisitUpdated, onVisitCancelled };
