#!/usr/bin/env bash
set -Eeuo pipefail

ARCHIVE="${ARCHIVE:-/home/ubuntu/rally-deploy.tar.gz}"
RELEASE_ID="${RELEASE_ID:-$(date -u +%Y%m%d%H%M%S)}"
RELEASE_DIR="/opt/rally/releases/${RELEASE_ID}"
NODE_BIN="$(command -v node)"
PUBLIC_IP="${PUBLIC_IP:-101.43.172.166}"
CERT_DIR="${CERT_DIR:-/etc/letsencrypt/live/${PUBLIC_IP}}"
NGINX_SITE="/etc/nginx/sites-available/rally"

test -r "${ARCHIVE}"
test -x "${NODE_BIN}"
command -v nginx >/dev/null
command -v openssl >/dev/null

install -d -m 0755 /opt/rally/releases
if [[ -e "${RELEASE_DIR}" ]]; then
  rm -rf -- "${RELEASE_DIR}"
fi
install -d -m 0755 "${RELEASE_DIR}"
tar -xzf "${ARCHIVE}" -C "${RELEASE_DIR}"

test -f "${RELEASE_DIR}/backend/package.json"
test -f "${RELEASE_DIR}/backend/src/server.js"
test -f "${RELEASE_DIR}/prototype/mobile-demo/index.html"

chown -R root:root "${RELEASE_DIR}"
chmod -R a+rX "${RELEASE_DIR}"

if ! id -u rally >/dev/null 2>&1; then
  useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin rally
fi

install -d -m 0755 /etc/rally
if [[ ! -f /etc/rally/rally.env ]]; then
  DEMO_ACCESS_KEY="$(openssl rand -hex 32)"
  TOUCH_DEVICE_ACCESS_KEY="$(openssl rand -hex 32)"
  AUTH_OTP_SECRET="$(openssl rand -hex 32)"
  AUTH_OAUTH_STATE_SECRET="$(openssl rand -hex 32)"
  ANALYTICS_ADMIN_TOKEN="$(openssl rand -hex 32)"
  umask 077
  printf '%s\n' \
    'PORT=8787' \
    'HOST=127.0.0.1' \
    'DATABASE_PATH=/var/lib/rally/demo.sqlite' \
    'ALLOW_INSECURE_DEMO_AUTH=0' \
    'ACTIVE_EVENT_ID=hackathon-2026' \
    'SOS_ENABLED=1' \
    'EXTERNAL_AID_ENABLED=1' \
    'PAID_AID_ENABLED=1' \
    "DEMO_ACCESS_KEY=${DEMO_ACCESS_KEY}" \
    "TOUCH_DEVICE_ACCESS_KEY=${TOUCH_DEVICE_ACCESS_KEY}" \
    "AUTH_OTP_SECRET=${AUTH_OTP_SECRET}" \
    "ANALYTICS_ADMIN_TOKEN=${ANALYTICS_ADMIN_TOKEN}" \
    "RALLY_APP_VERSION=${RELEASE_ID}" \
    "PUBLIC_APP_ORIGIN=https://${PUBLIC_IP}" \
    "PUBLIC_API_ORIGIN=https://${PUBLIC_IP}" \
    "AUTH_OAUTH_STATE_SECRET=${AUTH_OAUTH_STATE_SECRET}" \
    'TENCENT_SMS_SDK_APP_ID=1401184659' \
    'TENCENT_SMS_REGION=ap-guangzhou' \
    > /etc/rally/rally.env
fi

ensure_env_default() {
  local key="$1"
  local value="$2"
  if ! grep -q "^${key}=" /etc/rally/rally.env; then
    printf '%s=%s\n' "${key}" "${value}" >> /etc/rally/rally.env
  fi
}

append_secret_from_environment() {
  local key="$1"
  local value="${!key-}"
  if [[ -n "${value}" && "${value}" != *$'\n'* ]] && ! grep -q "^${key}=" /etc/rally/rally.env; then
    printf '%s=%s\n' "${key}" "${value}" >> /etc/rally/rally.env
  fi
}

if ! grep -q '^AUTH_OTP_SECRET=' /etc/rally/rally.env; then
  ensure_env_default AUTH_OTP_SECRET "$(openssl rand -hex 32)"
fi
if ! grep -q '^AUTH_OAUTH_STATE_SECRET=' /etc/rally/rally.env; then
  ensure_env_default AUTH_OAUTH_STATE_SECRET "$(openssl rand -hex 32)"
fi
if ! grep -q '^ANALYTICS_ADMIN_TOKEN=' /etc/rally/rally.env; then
  ensure_env_default ANALYTICS_ADMIN_TOKEN "$(openssl rand -hex 32)"
fi
ensure_env_default RALLY_APP_VERSION "${RELEASE_ID}"
ensure_env_default PUBLIC_APP_ORIGIN "https://${PUBLIC_IP}"
ensure_env_default PUBLIC_API_ORIGIN "https://${PUBLIC_IP}"
ensure_env_default TENCENT_SMS_SDK_APP_ID 1401184659
ensure_env_default TENCENT_SMS_REGION ap-guangzhou
for sms_secret in \
  TENCENT_SMS_SECRET_ID \
  TENCENT_SMS_SECRET_KEY \
  TENCENT_SMS_SIGN_NAME \
  TENCENT_SMS_TEMPLATE_ID
do
  append_secret_from_environment "${sms_secret}"
done
for oauth_secret in \
  GOOGLE_OAUTH_CLIENT_ID \
  GOOGLE_OAUTH_CLIENT_SECRET \
  WECHAT_OAUTH_APP_ID \
  WECHAT_OAUTH_APP_SECRET
do
  append_secret_from_environment "${oauth_secret}"
done
append_secret_from_environment ANDROID_APP_SHA256_CERT_FINGERPRINT
append_secret_from_environment AUTH_OTP_FIXED_DEMO
append_secret_from_environment AUTH_OTP_FIXED_DEMO_CODE
chown root:root /etc/rally/rally.env
chmod 0600 /etc/rally/rally.env

missing_sms_settings=()
for sms_setting in AUTH_OTP_SECRET; do
  if ! grep -Eq "^${sms_setting}=.+$" /etc/rally/rally.env; then
    missing_sms_settings+=("${sms_setting}")
  fi
done
fixed_demo_mode="$(sed -n 's/^AUTH_OTP_FIXED_DEMO=//p' /etc/rally/rally.env | tail -n 1)"
fixed_demo_code="$(sed -n 's/^AUTH_OTP_FIXED_DEMO_CODE=//p' /etc/rally/rally.env | tail -n 1)"
if [[ "${fixed_demo_mode}" == "1" ]]; then
  if [[ ! "${fixed_demo_code}" =~ ^[0-9]{6}$ ]]; then
    printf 'AUTH_OTP_FIXED_DEMO_CODE must contain exactly six digits.\n' >&2
    exit 1
  fi
else
  for sms_setting in \
    TENCENT_SMS_SECRET_ID \
    TENCENT_SMS_SECRET_KEY \
    TENCENT_SMS_SDK_APP_ID \
    TENCENT_SMS_SIGN_NAME \
    TENCENT_SMS_TEMPLATE_ID \
    TENCENT_SMS_REGION
  do
    if ! grep -Eq "^${sms_setting}=.+$" /etc/rally/rally.env; then
      missing_sms_settings+=("${sms_setting}")
    fi
  done
fi
if (( ${#missing_sms_settings[@]} > 0 )); then
  printf 'SMS login configuration is incomplete: %s\n' "${missing_sms_settings[*]}" >&2
  exit 1
fi

if [[ ! -s "${CERT_DIR}/fullchain.pem" || ! -s "${CERT_DIR}/privkey.pem" ]]; then
  printf 'Trusted HTTPS certificate for %s is missing under %s. Run deploy/enable-ip-https.sh first.\n' \
    "${PUBLIC_IP}" "${CERT_DIR}" >&2
  exit 1
fi

install -m 0644 /dev/stdin /etc/systemd/system/rally.service <<EOF
[Unit]
Description=COSPAN API service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=rally
Group=rally
WorkingDirectory=/opt/rally/current/backend
EnvironmentFile=/etc/rally/rally.env
ExecStart=${NODE_BIN} /opt/rally/current/backend/src/server.js
Restart=on-failure
RestartSec=3
UMask=0027
StateDirectory=rally
StateDirectoryMode=0750
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
LockPersonality=true
RestrictSUIDSGID=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
CapabilityBoundingSet=

[Install]
WantedBy=multi-user.target
EOF

rm -rf -- /var/www/rally
install -d -m 0755 /var/www/rally
cp -a "${RELEASE_DIR}/prototype/mobile-demo/." /var/www/rally/
chown -R root:root /var/www/rally
chmod -R a+rX /var/www/rally
android_cert_fingerprint="$(sed -n 's/^ANDROID_APP_SHA256_CERT_FINGERPRINT=//p' /etc/rally/rally.env | tail -n 1)"
if [[ -n "${android_cert_fingerprint}" ]]; then
  if [[ ! "${android_cert_fingerprint}" =~ ^([0-9A-F]{2}:){31}[0-9A-F]{2}$ ]]; then
    printf 'ANDROID_APP_SHA256_CERT_FINGERPRINT is not a SHA-256 certificate fingerprint.\n' >&2
    exit 1
  fi
  install -d -m 0755 /var/www/rally/.well-known
  install -m 0644 /dev/stdin /var/www/rally/.well-known/assetlinks.json <<EOF
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "ai.rally.collaboration",
      "sha256_cert_fingerprints": ["${android_cert_fingerprint}"]
    }
  }
]
EOF
fi
ln -sfn "${RELEASE_DIR}" /opt/rally/current

NGINX_BACKUP=""
if [[ -f "${NGINX_SITE}" ]]; then
  install -d -m 0700 /etc/nginx/rally-backups
  NGINX_BACKUP="/etc/nginx/rally-backups/rally.$(date -u +%Y%m%dT%H%M%SZ).conf"
  install -m 0600 "${NGINX_SITE}" "${NGINX_BACKUP}"
fi

rollback_nginx() {
  if [[ -n "${NGINX_BACKUP}" && -f "${NGINX_BACKUP}" ]]; then
    printf 'Deployment failed; restoring Nginx configuration from %s.\n' "${NGINX_BACKUP}" >&2
    install -m 0644 "${NGINX_BACKUP}" "${NGINX_SITE}"
    nginx -t && systemctl reload nginx.service
  fi
}
trap rollback_nginx ERR

install -m 0644 /dev/stdin "${NGINX_SITE}" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${PUBLIC_IP};

    root /var/www/rally;
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

    root /var/www/rally;
    index index.html;
    client_max_body_size 2m;
    server_tokens off;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

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

rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/rally /etc/nginx/sites-enabled/rally

systemctl daemon-reload
systemctl enable rally.service
systemctl restart rally.service
nginx -t
systemctl enable nginx.service
systemctl reload nginx.service

if command -v ufw >/dev/null && ufw status | grep -q '^Status: active'; then
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
fi

for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8787/health \
    | grep -Eq '"status":"ok".*"sms_login":"ready".*"analytics":"ready"'; then
    break
  fi
  sleep 1
done

curl -fsS http://127.0.0.1:8787/health | grep -Eq '"status":"ok".*"sms_login":"ready"'
curl -fsS "https://${PUBLIC_IP}/health" | grep -Eq '"status":"ok".*"sms_login":"ready"'
curl -fsSI "http://${PUBLIC_IP}/" | grep -Eq '^HTTP/[^ ]+ 30(1|7|8)'
openssl s_client -connect "${PUBLIC_IP}:443" -verify_ip "${PUBLIC_IP}" </dev/null 2>/dev/null \
  | grep -q 'Verification: OK'
test "$(systemctl is-active rally.service)" = "active"
test "$(systemctl is-active nginx.service)" = "active"

trap - ERR

rm -f /tmp/rally-upload.b64
install -d -m 0755 /tmp/RALLY_INSTALL_OK
printf '%s\n' 'RALLY_INSTALL_OK'
