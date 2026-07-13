const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { nowIST } = require('./lib/time');

let db = null;

function getDb() {
  if (db) return db;
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'crm.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  runMigrations(db);
  return db;
}

function runMigrations(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(db.prepare('SELECT version FROM schema_version').all().map((r) => r.version));
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const version = parseInt(file, 10);
    if (!Number.isInteger(version)) throw new Error(`migration file must start with a number: ${file}`);
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(version, nowIST());
    })();
    console.log(`migration applied: ${file}`);
  }
}

module.exports = { getDb };
