#!/usr/bin/env bash
# Weekly SQLite backup: .backup -> integrity check -> gzip -> age encrypt -> DO Spaces (BLR1).
# Cron (root): 0 2 * * 0 /opt/crm/deploy/backup.sh   (02:00 IST Sunday if TZ=Asia/Kolkata)
set -euo pipefail

ENV_FILE=/etc/crm/.env
set -a; source "$ENV_FILE"; set +a

DB="${DB_PATH:-/opt/crm/data/crm.db}"
LOG="${BACKUP_LOG:-/var/log/crm-backup.log}"
RETENTION_DAYS=30
STAMP=$(date +%Y%m%d-%H%M%S)
NAME="crm-${STAMP}.db"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

fail() {
  echo "$(date -Iseconds) FAIL $1" >> "$LOG"
  exit 1
}

command -v sqlite3 >/dev/null || fail "sqlite3 not installed"
command -v age >/dev/null || fail "age not installed"
command -v s3cmd >/dev/null || fail "s3cmd not installed"
[ -n "${BACKUP_AGE_RECIPIENT:-}" ] || fail "BACKUP_AGE_RECIPIENT not set"
[ -n "${SPACES_BUCKET:-}" ] || fail "SPACES_BUCKET not set"

# 1. Consistent online backup
sqlite3 "$DB" ".backup '$TMP/$NAME'" || fail "sqlite .backup failed"

# 2. Verify the copy opens and is intact before uploading
CHECK=$(sqlite3 "$TMP/$NAME" "PRAGMA integrity_check;") || fail "integrity_check could not run"
[ "$CHECK" = "ok" ] || fail "integrity_check returned: $CHECK"

# 3. Compress + encrypt
gzip "$TMP/$NAME" || fail "gzip failed"
age -r "$BACKUP_AGE_RECIPIENT" -o "$TMP/$NAME.gz.age" "$TMP/$NAME.gz" || fail "age encryption failed"

# 4. Upload to Spaces (data stays in BLR1)
S3CFG=(--access_key="$SPACES_ACCESS_KEY" --secret_key="$SPACES_SECRET_KEY"
       --host="${SPACES_REGION}.digitaloceanspaces.com"
       --host-bucket="%(bucket)s.${SPACES_REGION}.digitaloceanspaces.com")
s3cmd "${S3CFG[@]}" put "$TMP/$NAME.gz.age" "s3://${SPACES_BUCKET}/backups/$NAME.gz.age" || fail "upload failed"

# 5. Prune backups older than RETENTION_DAYS
CUTOFF=$(date -d "-${RETENTION_DAYS} days" +%s)
s3cmd "${S3CFG[@]}" ls "s3://${SPACES_BUCKET}/backups/" | while read -r fdate ftime _ fpath; do
  [ -n "${fpath:-}" ] || continue
  fts=$(date -d "$fdate $ftime" +%s 2>/dev/null) || continue
  if [ "$fts" -lt "$CUTOFF" ]; then
    s3cmd "${S3CFG[@]}" del "$fpath" || true
  fi
done

echo "$(date -Iseconds) OK $NAME.gz.age" >> "$LOG"
