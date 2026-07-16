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
      // 30s, not a few seconds: the agent runs on Render's free tier and a
      // cold start (spun down after idle) can take ~20s to answer. A short
      // timeout would abort mid-wake and falsely report the agent as down.
      const r = await fetch(agentUrl + '/', {
        method: 'GET',
        signal: AbortSignal.timeout(30000),
      });
      agent = r.ok ? 'up' : 'down';
    } catch {
      agent = 'down';
    }
  }
  res.json({ crm: 'up', agent, pinged_at: new Date().toISOString() });
});

module.exports = router;
