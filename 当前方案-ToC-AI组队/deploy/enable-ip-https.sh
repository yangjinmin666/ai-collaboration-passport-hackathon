#!/usr/bin/env bash
set -Eeuo pipefail

PUBLIC_IP="${PUBLIC_IP:-49.233.197.225}"
WEBROOT="${WEBROOT:-/var/www/rally}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/rally}"
CERTBOT_MIN_VERSION="5.4"

if [[ "${EUID}" -ne 0 ]]; then
  printf '%s\n' 'Run this script as root (for example: sudo ./enable-ip-https.sh).' >&2
  exit 1
fi

command -v nginx >/dev/null
command -v curl >/dev/null
command -v openssl >/dev/null
test -d "${WEBROOT}"
test -f "${NGINX_SITE}"

install_certbot() {
  local certbot_bin certbot_version
  certbot_bin="$(command -v certbot || true)"
  certbot_version=""
  if [[ -n "${certbot_bin}" ]]; then
    certbot_version="$(${certbot_bin} --version 2>&1 | awk '{print $2}')"
  fi

  if [[ -n "${certbot_version}" ]] && dpkg --compare-versions "${certbot_version}" ge "${CERTBOT_MIN_VERSION}"; then
    printf '%s\n' "Using Certbot ${certbot_version} at ${certbot_bin}."
    CERTBOT_BIN="${certbot_bin}"
    return
  fi

  if ! command -v snap >/dev/null; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y snapd
    systemctl enable --now snapd.socket
  fi

  snap install certbot --classic
  CERTBOT_BIN="/snap/bin/certbot"
  certbot_version="$(${CERTBOT_BIN} --version 2>&1 | awk '{print $2}')"
  if ! dpkg --compare-versions "${certbot_version}" ge "${CERTBOT_MIN_VERSION}"; then
    printf '%s\n' "Certbot ${CERTBOT_MIN_VERSION}+ is required; found ${certbot_version}." >&2
    exit 1
  fi
}

install_certbot

install -d -m 0755 "${WEBROOT}/.well-known/acme-challenge"

certbot_args=(
  certonly
  --non-interactive
  --agree-tos
  --preferred-profile shortlived
  --webroot
  --webroot-path "${WEBROOT}"
  --ip-address "${PUBLIC_IP}"
  --cert-name "${PUBLIC_IP}"
)

if [[ -n "${LE_EMAIL:-}" ]]; then
  certbot_args+=(--email "${LE_EMAIL}")
else
  certbot_args+=(--register-unsafely-without-email)
fi

"${CERTBOT_BIN}" "${certbot_args[@]}"

CERT_DIR="/etc/letsencrypt/live/${PUBLIC_IP}"
test -s "${CERT_DIR}/fullchain.pem"
test -s "${CERT_DIR}/privkey.pem"

BACKUP_DIR="/etc/nginx/rally-backups"
BACKUP_FILE="${BACKUP_DIR}/rally.$(date -u +%Y%m%dT%H%M%SZ).conf"
install -d -m 0700 "${BACKUP_DIR}"
install -m 0600 "${NGINX_SITE}" "${BACKUP_FILE}"

rollback_nginx() {
  printf '%s\n' "HTTPS activation failed; restoring ${BACKUP_FILE}." >&2
  install -m 0644 "${BACKUP_FILE}" "${NGINX_SITE}"
  nginx -t
  systemctl reload nginx
}
trap rollback_nginx ERR

install -m 0644 /dev/stdin "${NGINX_SITE}" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${PUBLIC_IP};

    root ${WEBROOT};
    server_tokens off;

    location ^~ /.well-known/acme-challenge/ {
        default_type text/plain;
        try_files \$uri =404;
    }

    location / {
        return 308 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name ${PUBLIC_IP};

    ssl_certificate ${CERT_DIR}/fullchain.pem;
    ssl_certificate_key ${CERT_DIR}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:RALLY_SSL:10m;
    ssl_session_timeout 1d;

    root ${WEBROOT};
    index index.html;
    client_max_body_size 2m;
    server_tokens off;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Permissions-Policy "geolocation=(self)" always;

    location = /health {
        proxy_pass http://127.0.0.1:8787/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /c/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

nginx -t
systemctl reload nginx

if command -v ufw >/dev/null && ufw status | grep -q '^Status: active'; then
  ufw allow 443/tcp >/dev/null
fi

install -m 0644 /dev/stdin /etc/systemd/system/rally-certbot-renew.service <<EOF
[Unit]
Description=Renew the COSPAN Let's Encrypt IP certificate
After=network-online.target nginx.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=${CERTBOT_BIN} renew --quiet --deploy-hook "/usr/bin/systemctl reload nginx"
EOF

install -m 0644 /dev/stdin /etc/systemd/system/rally-certbot-renew.timer <<'EOF'
[Unit]
Description=Check the COSPAN IP certificate three times daily

[Timer]
OnCalendar=*-*-* 03,11,19:17:00
RandomizedDelaySec=30m
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now rally-certbot-renew.timer

curl -fsS "https://${PUBLIC_IP}/health" | grep -q '"status":"ok"'
curl -fsSI "http://${PUBLIC_IP}/" | grep -Eq '^HTTP/[^ ]+ 30(1|7|8)'
openssl s_client -connect "${PUBLIC_IP}:443" -verify_ip "${PUBLIC_IP}" </dev/null 2>/dev/null \
  | grep -q 'Verification: OK'
test "$(systemctl is-active nginx.service)" = "active"
test "$(systemctl is-enabled rally-certbot-renew.timer)" = "enabled"

trap - ERR
printf '%s\n' "RALLY_HTTPS_OK https://${PUBLIC_IP}/"
printf '%s\n' "NGINX_BACKUP ${BACKUP_FILE}"
