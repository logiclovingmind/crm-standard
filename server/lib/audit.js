const { getDb } = require('../db');
const { nowIST } = require('./time');

function audit(userId, action, detail) {
  getDb()
    .prepare('INSERT INTO audit_log (user_id, action, detail, created_at) VALUES (?, ?, ?, ?)')
    .run(userId ?? null, action, detail ?? null, nowIST());
}

module.exports = { audit };
