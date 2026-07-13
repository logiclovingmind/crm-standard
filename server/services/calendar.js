// One-way CRM → Google Calendar sync via a service account. No googleapis
// dependency — a signed JWT + the Calendar REST API keeps RAM/deps low.
// Every entry point is fire-and-forget: a Calendar failure must never fail
// the CRM operation. Log and move on.
const fs = require('fs');
const crypto = require('crypto');
const { getDb } = require('../db');
const { nowIST } = require('../lib/time');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar';
const RETRIES = 3;

let tokenCache = { token: null, expiresAt: 0 };

function isEnabled() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE && process.env.GOOGLE_CALENDAR_ID);
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

async function getAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token;

  const key = JSON.parse(fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })
  );
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(key.private_key).toString('base64url');
  const jwt = `${header}.${claims}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return tokenCache.token;
}

async function calendarRequest(method, path, body) {
  const token = await getAccessToken();
  const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID);
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 410 || res.status === 404) return null; // event already gone
  if (!res.ok) throw new Error(`calendar ${method} ${path} failed: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
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

function eventBody(visit) {
  const start = new Date(visit.scheduled_at);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const where = [visit.project_name, visit.unit_identifier].filter(Boolean).join(' / ');
  return {
    summary: `Site visit: ${visit.lead_name}`,
    description: [
      `Lead: ${visit.lead_name} (${visit.lead_phone})`,
      visit.agent_name ? `Agent: ${visit.agent_name}` : null,
      where ? `Property: ${where}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    location: where || undefined,
    start: { dateTime: start.toISOString(), timeZone: 'Asia/Kolkata' },
    end: { dateTime: end.toISOString(), timeZone: 'Asia/Kolkata' },
  };
}

function onVisitCreated(visitId) {
  if (!isEnabled()) return;
  withRetry(`create event for visit ${visitId}`, async () => {
    const visit = loadVisit(visitId);
    if (!visit || visit.status !== 'scheduled') return;
    const event = await calendarRequest('POST', '/events', eventBody(visit));
    if (event?.id) {
      getDb()
        .prepare('UPDATE site_visits SET google_event_id = ?, updated_at = ? WHERE id = ?')
        .run(event.id, nowIST(), visitId);
    }
  });
}

function onVisitUpdated(visitId) {
  if (!isEnabled()) return;
  withRetry(`update event for visit ${visitId}`, async () => {
    const visit = loadVisit(visitId);
    if (!visit) return;
    if (!visit.google_event_id) return onVisitCreated(visitId);
    await calendarRequest('PATCH', `/events/${encodeURIComponent(visit.google_event_id)}`, eventBody(visit));
  });
}

function onVisitCancelled(visitId) {
  if (!isEnabled()) return;
  withRetry(`cancel event for visit ${visitId}`, async () => {
    const visit = loadVisit(visitId);
    if (!visit?.google_event_id) return;
    await calendarRequest('DELETE', `/events/${encodeURIComponent(visit.google_event_id)}`);
  });
}

module.exports = { onVisitCreated, onVisitUpdated, onVisitCancelled };
