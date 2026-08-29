#!/usr/bin/env bash
set -Eeuo pipefail

ARCHIVE="${ARCHIVE:-/home/ubuntu/rally-deploy.tar.gz}"
RELEASE_ID="${RELEASE_ID:-$(date -u +%Y%m%d%H%M%S)}"
RELEASE_DIR="/opt/rally/releases/${RELEASE_ID}"
NODE_BIN="$(command -v node)"

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
ln -sfn "${RELEASE_DIR}" /opt/rally/current

if ! id -u rally >/dev/null 2>&1; then
  useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin rally
fi

install -d -m 0755 /etc/rally
if [[ ! -f /etc/rally/rally.env ]]; then
  DEMO_ACCESS_KEY="$(openssl rand -hex 32)"
  TOUCH_DEVICE_ACCESS_KEY="$(openssl rand -hex 32)"
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
    > /etc/rally/rally.env
fi
chown root:root /etc/rally/rally.env
chmod 0600 /etc/rally/rally.env

install -m 0644 /dev/stdin /etc/systemd/system/rally.service <<EOF
[Unit]
Description=RALLY API service
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

install -m 0644 /dev/stdin /etc/nginx/sites-available/rally <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/rally;
    index index.html;
    client_max_body_size 2m;
    server_tokens off;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location = /health {
        proxy_pass http://127.0.0.1:8787/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /c/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
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
fi

for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8787/health | grep -q '"status":"ok"'; then
    break
  fi
  sleep 1
done

curl -fsS http://127.0.0.1:8787/health | grep -q '"status":"ok"'
curl -fsS http://127.0.0.1/health | grep -q '"status":"ok"'
test "$(systemctl is-active rally.service)" = "active"
test "$(systemctl is-active nginx.service)" = "active"

rm -f /tmp/rally-upload.b64
install -d -m 0755 /tmp/RALLY_INSTALL_OK
printf '%s\n' 'RALLY_INSTALL_OK'
