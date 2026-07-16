const express = require('express');
const { safeEqual } = require('../middleware/csrf');
const { intake } = require('../services/whatsappIntake');
const calendar = require('../services/calendar');
const { getDb } = require('../db');

const router = express.Router();

function requireBotToken(req, res, next) {
  const expected = process.env.WHATSAPP_BOT_TOKEN;
  const provided = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!expected || !provided || !safeEqual(provided, expected)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

router.post('/whatsapp/lead', requireBotToken, (req, res) => {
  const result = intake(req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });

  // Respond first (<500ms contract), then sync Calendar async.
  res.status(result.created ? 201 : 200).json({
    lead_id: result.leadId,
    created: result.created,
    visit_id: result.visitId ?? null,
  });
  if (result.visitId) calendar.onVisitCreated(result.visitId);
});

// Brochure catalog for the WhatsApp agent. It pulls this list (bearer-authed)
// instead of a hardcoded env var, so uploading a PDF in the CRM is all the
// broker needs to do — no agent redeploy. Each url is the public download route.
router.get('/whatsapp/brochures', requireBotToken, (req, res) => {
  const rows = getDb()
    .prepare('SELECT id, name, location, brochure_filename FROM projects WHERE brochure_filename IS NOT NULL ORDER BY name')
    .all();
  const base = `${req.protocol}://${req.get('host')}`;
  const brochures = rows.map((p) => ({
    project: p.name,
    location: p.location || null,
    filename: p.brochure_filename,
    url: `${base}/brochures/${p.id}`,
  }));
  res.json({ brochures });
});

module.exports = router;
