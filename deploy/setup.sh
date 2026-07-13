#!/usr/bin/env bash
# Fresh Ubuntu 24.04 droplet -> running CRM in one run. Idempotent: safe to re-run.
# Usage: CRM_DOMAIN=crm.example.com bash deploy/setup.sh
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }
CRM_DOMAIN="${CRM_DOMAIN:?set CRM_DOMAIN=your.domain before running}"
APP_DIR=/opt/crm
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ufw fail2ban sqlite3 age s3cmd curl gnupg ca-certificates

echo "==> Node.js 22 LTS"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

echo "==> Caddy"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy
fi

echo "==> System user + app directory"
id crm &>/dev/null || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin crm
mkdir -p "$APP_DIR" "$APP_DIR/data" /etc/crm /var/log/caddy
if [ "$REPO_DIR" != "$APP_DIR" ]; then
  rsync -a --delete --exclude node_modules --exclude data --exclude .env "$REPO_DIR/" "$APP_DIR/"
fi

echo "==> Environment file"
if [ ! -f /etc/crm/.env ]; then
  cp "$APP_DIR/.env.example" /etc/crm/.env
  sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$(openssl rand -hex 32)|" /etc/crm/.env
  sed -i "s|^WHATSAPP_BOT_TOKEN=.*|WHATSAPP_BOT_TOKEN=$(openssl rand -hex 32)|" /etc/crm/.env
  chmod 600 /etc/crm/.env
  echo "    /etc/crm/.env created — fill in Spaces/Calendar/age values"
fi

echo "==> Install + build"
cd "$APP_DIR"
npm ci --omit=dev
npm --prefix client ci
npm --prefix client run build
chown -R crm:crm "$APP_DIR"

echo "==> Firewall (ufw)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

echo "==> fail2ban jail for login endpoint (via Caddy JSON logs)"
cat > /etc/fail2ban/filter.d/crm-login.conf <<'EOF'
[Definition]
failregex = ^.*"uri":"/api/auth/login".*"status":401.*"client_ip":"<HOST>".*$
            ^.*"client_ip":"<HOST>".*"uri":"/api/auth/login".*"status":401.*$
EOF
cat > /etc/fail2ban/jail.d/crm-login.local <<'EOF'
[crm-login]
enabled = true
port = http,https
filter = crm-login
logpath = /var/log/caddy/crm-access.log
maxretry = 10
findtime = 900
bantime = 3600
EOF
systemctl restart fail2ban

echo "==> Caddy config"
cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
mkdir -p /etc/systemd/system/caddy.service.d
cat > /etc/systemd/system/caddy.service.d/crm-domain.conf <<EOF
[Service]
Environment=CRM_DOMAIN=${CRM_DOMAIN}
EOF
systemctl daemon-reload
systemctl enable --now caddy
systemctl restart caddy

echo "==> systemd unit"
cp "$APP_DIR/deploy/crm.service" /etc/systemd/system/crm.service
systemctl daemon-reload
systemctl enable --now crm
systemctl restart crm

echo "==> Weekly backup cron (Sunday 02:00 IST)"
chmod +x "$APP_DIR/deploy/backup.sh"
cat > /etc/cron.d/crm-backup <<EOF
TZ=Asia/Kolkata
0 2 * * 0 root $APP_DIR/deploy/backup.sh
EOF
touch /var/log/crm-backup.log

echo "==> First admin account"
OWNER_COUNT=$(cd "$APP_DIR" && sudo -u crm env $(grep -v '^#' /etc/crm/.env | tr '\n' ' ') node -e "const{getDb}=require('./server/db');console.log(getDb().prepare(\"SELECT COUNT(*) n FROM users WHERE role='owner'\").get().n)")
if [ "$OWNER_COUNT" = "0" ]; then
  ADMIN_PASSWORD=$(openssl rand -base64 12)
  cd "$APP_DIR" && sudo -u crm env $(grep -v '^#' /etc/crm/.env | tr '\n' ' ') \
    node scripts/create-admin.js "Owner" "owner@${CRM_DOMAIN}" "$ADMIN_PASSWORD"
  echo ""
  echo "    First admin: owner@${CRM_DOMAIN} / ${ADMIN_PASSWORD}"
  echo "    (change this password after first login)"
fi

echo ""
echo "Done. CRM should be live at https://${CRM_DOMAIN} once DNS points here."
