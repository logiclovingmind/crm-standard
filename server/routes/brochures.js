const express = require('express');
const { getDb } = require('../db');
const brochureStore = require('../lib/brochureStore');

// Public, unauthenticated brochure download. WhatsApp fetches this URL
// server-side to deliver the PDF, so it can't sit behind a session/CSRF gate.
// Only exposes files that a project row references — nothing else on disk.
const router = express.Router();

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'not found' });
  const project = getDb().prepare('SELECT id, brochure_filename FROM projects WHERE id = ?').get(id);
  if (!project || !project.brochure_filename || !brochureStore.exists(id)) {
    return res.status(404).json({ error: 'not found' });
  }
  const safe = project.brochure_filename.replace(/[^\w.\- ]+/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${safe}"`);
  res.sendFile(brochureStore.filePath(id));
});

module.exports = router;
