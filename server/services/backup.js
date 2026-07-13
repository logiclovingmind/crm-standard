// deploy/backup.sh appends one line per run to BACKUP_LOG:
//   <ISO timestamp> OK <filename>   or   <ISO timestamp> FAIL <reason>
// The owner dashboard shows a warning banner when the last run failed or the
// last success is older than 8 days (weekly cadence + 1 day of grace).
const fs = require('fs');

const MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;

function getBackupStatus() {
  const logPath = process.env.BACKUP_LOG || '/var/log/crm-backup.log';
  let lines;
  try {
    lines = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
  } catch {
    return { ok: false, message: 'no backup has run yet' };
  }
  if (!lines.length) return { ok: false, message: 'no backup has run yet' };

  const last = lines[lines.length - 1];
  const [timestamp, result, ...rest] = last.split(' ');
  const age = Date.now() - new Date(timestamp).getTime();

  if (result !== 'OK') return { ok: false, message: `last backup failed: ${rest.join(' ') || 'unknown error'}` };
  if (Number.isNaN(age) || age > MAX_AGE_MS) {
    return { ok: false, message: `last successful backup is older than 7 days (${timestamp})` };
  }
  return { ok: true, message: `last backup ${timestamp}` };
}

module.exports = { getBackupStatus };
