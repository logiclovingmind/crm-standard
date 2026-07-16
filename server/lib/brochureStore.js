// On-disk store for project brochure PDFs. Files live next to the SQLite DB
// (data/brochures/), one PDF per project named by id. On Render's free tier
// this dir is ephemeral (wiped on redeploy/idle) — fine for a demo; on the
// droplet it persists. The projects.brochure_filename column holds the
// original display name; the bytes live here.

const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'crm.db');
const DIR = path.join(path.dirname(DB_PATH), 'brochures');

function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

function filePath(projectId) {
  return path.join(DIR, `project-${projectId}.pdf`);
}

function save(projectId, buf) {
  ensureDir();
  fs.writeFileSync(filePath(projectId), buf);
}

function remove(projectId) {
  try {
    fs.unlinkSync(filePath(projectId));
  } catch {
    /* already gone (e.g. ephemeral disk wiped) — nothing to do */
  }
}

function exists(projectId) {
  return fs.existsSync(filePath(projectId));
}

module.exports = { DIR, filePath, save, remove, exists, ensureDir };
