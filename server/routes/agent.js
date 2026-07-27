const express = require('express');
const router = express.Router();

// Thin proxy that lets the CRM's Train page drive the WhatsApp agent through
// its /api/simulate endpoints. Session auth here (client-side) + bearer token
// to the agent (server-side) — the shared secret never leaves the CRM.

function agentConfig() {
  const url = (process.env.AGENT_URL || '').replace(/\/+$/, '');
  const token = process.env.SIMULATE_TOKEN || '';
  if (!url || !token) return null;
  return { url, token };
}

async function callAgent(path, { method = 'GET', body, query } = {}) {
  const cfg = agentConfig();
  if (!cfg) {
    const err = new Error('AGENT_URL / SIMULATE_TOKEN not configured on the OS');
    err.status = 503;
    throw err;
  }
  let url = cfg.url + path;
  if (query) {
    const qs = new URLSearchParams(query).toString();
    if (qs) url += '?' + qs;
  }
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(45000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `agent HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

router.post('/chat', async (req, res, next) => {
  try {
    const { phone, message } = req.body || {};
    if (typeof phone !== 'string' || !phone.trim()) return res.status(400).json({ error: 'phone required' });
    if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'message required' });
    const data = await callAgent('/api/simulate', { method: 'POST', body: { phone, message } });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/reset', async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (typeof phone !== 'string' || !phone.trim()) return res.status(400).json({ error: 'phone required' });
    const data = await callAgent('/api/simulate/reset', { method: 'POST', body: { phone } });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/conversation', async (req, res) => {
  try {
    const phone = String(req.query.phone || '').trim();
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const data = await callAgent('/api/simulate/conversation', { query: { phone } });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
