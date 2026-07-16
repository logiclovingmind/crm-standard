const express = require('express');
const { getDb } = require('../db');
const { nowIST } = require('../lib/time');
const { requireRole } = require('../middleware/auth');
const brochureStore = require('../lib/brochureStore');

const UNIT_TYPES = ['1BHK', '2BHK', '3BHK', 'plot', 'villa'];
const UNIT_STATUSES = ['available', 'blocked', 'sold'];

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB — brochures are a few pages
// Buffer the raw upload ourselves (no multer): the client POSTs the PDF bytes
// as the request body with content-type application/pdf.
const pdfRaw = express.raw({ type: ['application/pdf', 'application/octet-stream'], limit: MAX_PDF_BYTES });

const router = express.Router();
const canEdit = requireRole('owner', 'manager');

function sanitizeFilename(raw) {
  let name = String(raw || 'brochure.pdf')
    .replace(/[\r\n"\\/]+/g, ' ')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .slice(0, 120);
  if (!name) name = 'brochure.pdf';
  if (!/\.pdf$/i.test(name)) name += '.pdf';
  return name;
}

router.get('/projects', (req, res) => {
  const projects = getDb()
    .prepare(
      `SELECT p.*, COUNT(u.id) AS unit_count,
              SUM(CASE WHEN u.status = 'available' THEN 1 ELSE 0 END) AS available_count
       FROM projects p LEFT JOIN units u ON u.project_id = p.id
       GROUP BY p.id ORDER BY p.name`
    )
    .all();
  res.json({ projects });
});

router.post('/projects', canEdit, (req, res) => {
  const { name, location, description } = req.body || {};
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
  const now = nowIST();
  const info = getDb()
    .prepare('INSERT INTO projects (name, location, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(name.trim(), location || null, description || null, now, now);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/projects/:id', canEdit, (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'not found' });
  const { name, location, description } = req.body || {};
  db.prepare('UPDATE projects SET name = ?, location = ?, description = ?, updated_at = ? WHERE id = ?').run(
    typeof name === 'string' && name.trim() ? name.trim() : project.name,
    location !== undefined ? location : project.location,
    description !== undefined ? description : project.description,
    nowIST(),
    project.id
  );
  res.json({ ok: true });
});

// Upload (or replace) a project's brochure PDF. Raw-body upload, PDF-only.
router.post('/projects/:id/brochure', canEdit, pdfRaw, (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'not found' });
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length === 0) return res.status(400).json({ error: 'empty upload' });
  if (buf.length < 5 || buf.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return res.status(400).json({ error: 'not a PDF' });
  }
  const filename = sanitizeFilename(req.get('x-filename'));
  brochureStore.save(project.id, buf);
  db.prepare('UPDATE projects SET brochure_filename = ?, updated_at = ? WHERE id = ?').run(
    filename,
    nowIST(),
    project.id
  );
  res.json({ ok: true, filename });
});

router.delete('/projects/:id/brochure', canEdit, (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'not found' });
  brochureStore.remove(project.id);
  db.prepare('UPDATE projects SET brochure_filename = NULL, updated_at = ? WHERE id = ?').run(nowIST(), project.id);
  res.json({ ok: true });
});

router.get('/units', (req, res) => {
  let sql = `SELECT u.*, p.name AS project_name FROM units u JOIN projects p ON p.id = u.project_id WHERE 1=1`;
  const params = [];
  if (req.query.project_id) {
    sql += ' AND u.project_id = ?';
    params.push(req.query.project_id);
  }
  if (req.query.status && UNIT_STATUSES.includes(req.query.status)) {
    sql += ' AND u.status = ?';
    params.push(req.query.status);
  }
  sql += ' ORDER BY p.name, u.identifier';
  res.json({ units: getDb().prepare(sql).all(...params) });
});

router.post('/units', canEdit, (req, res) => {
  const { project_id, identifier, type, area_sqft, price } = req.body || {};
  const db = getDb();
  if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(project_id)) {
    return res.status(400).json({ error: 'invalid project' });
  }
  if (!identifier || typeof identifier !== 'string') return res.status(400).json({ error: 'identifier required' });
  if (!UNIT_TYPES.includes(type)) return res.status(400).json({ error: 'invalid unit type' });
  const now = nowIST();
  try {
    const info = db
      .prepare(
        'INSERT INTO units (project_id, identifier, type, area_sqft, price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(project_id, identifier.trim(), type, area_sqft || null, price || null, now, now);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'unit identifier already exists in this project' });
    }
    throw err;
  }
});

router.put('/units/:id', canEdit, (req, res) => {
  const db = getDb();
  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
  if (!unit) return res.status(404).json({ error: 'not found' });
  const { identifier, type, area_sqft, price, status } = req.body || {};
  if (type !== undefined && !UNIT_TYPES.includes(type)) return res.status(400).json({ error: 'invalid unit type' });
  if (status !== undefined && !UNIT_STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' });
  db.prepare(
    'UPDATE units SET identifier = ?, type = ?, area_sqft = ?, price = ?, status = ?, updated_at = ? WHERE id = ?'
  ).run(
    typeof identifier === 'string' && identifier.trim() ? identifier.trim() : unit.identifier,
    type ?? unit.type,
    area_sqft !== undefined ? area_sqft : unit.area_sqft,
    price !== undefined ? price : unit.price,
    status ?? unit.status,
    nowIST(),
    unit.id
  );
  res.json({ ok: true });
});

module.exports = router;
