const express = require('express');
const router = express.Router();

// GET /api/status/system — used by the CRM's Keep-awake toggle. Hitting
// this endpoint keeps the CRM warm (self-traffic) and its server-side
// fetch to AGENT_URL keeps the WhatsApp agent warm too. One request →
// both services touched.
router.get('/system', async (_req, res) => {
  const agentUrl = (process.env.AGENT_URL || '').replace(/\/+$/, '');
  let agent = 'unknown';
  if (agentUrl) {
    try {
      const r = await fetch(agentUrl + '/', {
        method: 'GET',
        signal: AbortSignal.timeout(6000),
      });
      agent = r.ok ? 'up' : 'down';
    } catch {
      agent = 'down';
    }
  }
  res.json({ crm: 'up', agent, pinged_at: new Date().toISOString() });
});

module.exports = router;
