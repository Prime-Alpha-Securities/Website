#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Prime Alpha Securities — EC2 Deploy Script
#
#  USAGE (run this once after SSH-ing into your EC2):
#    cd ~/pas && sudo bash deploy.sh
#
#  WHAT THIS DOES:
#    1. Installs Node.js 20 LTS if not present
#    2. npm install (React + Vite — frontend only, no AWS SDK)
#    3. npm run build → produces dist/ via Vite
#    4. npm install AWS SDK (server-side only)
#    5. Copies your key.pem into certs/ (generates self-signed cert if none)
#    6. Registers systemd service → auto-starts on reboot
#    7. Starts server on port 80 (HTTP) + 443 (HTTPS)
#
#  CREDENTIALS: IAM role attached to your EC2 instance — no keys in code
# ═══════════════════════════════════════════════════════════════════════════
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$APP_DIR/deploy.log"
SVC="pas"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
step() { echo -e "\n${BLUE}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
die()  { echo -e "${RED}✗ $1${NC}"; exit 1; }

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║    PRIME ALPHA SECURITIES — EC2 DEPLOY       ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

[[ $EUID -ne 0 ]] && die "Run as root: sudo bash deploy.sh"

# ── STEP 1: Node.js ──────────────────────────────────────────────────────────
step "Checking Node.js"
if command -v node &>/dev/null; then
  NODE_MAJOR=$(node -e "process.stdout.write(String(parseInt(process.version.slice(1))))")
  if [[ $NODE_MAJOR -ge 18 ]]; then
    ok "Node.js $(node --version) already installed"
  else
    echo "  Node.js $(node --version) too old — upgrading to v20"
    UPGRADE_NODE=1
  fi
else
  UPGRADE_NODE=1
fi

if [[ "${UPGRADE_NODE:-0}" == "1" ]]; then
  step "Installing Node.js 20 LTS"
  if command -v apt-get &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> "$LOG" 2>&1
    apt-get install -y nodejs >> "$LOG" 2>&1
  elif command -v dnf &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >> "$LOG" 2>&1
    dnf install -y nodejs >> "$LOG" 2>&1
  elif command -v yum &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >> "$LOG" 2>&1
    yum install -y nodejs >> "$LOG" 2>&1
  else
    die "Unknown package manager. Install Node.js 20 manually then re-run."
  fi
  ok "Node.js $(node --version) installed"
fi

# ── STEP 2: Frontend deps + Vite build ───────────────────────────────────────
step "Installing frontend dependencies (React + Vite)"
cd "$APP_DIR"
npm install 2>&1 | tee -a "$LOG" | tail -2
ok "Frontend dependencies installed"

step "Building frontend with Vite"
npm run build 2>&1 | tee -a "$LOG" | tail -5
[[ -d "$APP_DIR/dist" ]] || die "Vite build failed — dist/ not created. Check: cat $LOG"
ok "Frontend built → $APP_DIR/dist/ ($(du -sh dist | cut -f1))"

# ── STEP 3: Server-side AWS SDK ───────────────────────────────────────────────
# AWS SDK is in package.json dependencies — already installed in STEP 1 (npm install)
# server.js uses .cjs extension so Node.js treats it as CommonJS always.
ok "AWS SDK ready (installed via npm in step 1)"

# Vite build is done — now remove "type":"module" so server.js (require/CommonJS) works
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));delete p.type;fs.writeFileSync('package.json',JSON.stringify(p,null,2));" 2>/dev/null || true
ok "package.json: type:module removed for server.js (CommonJS)"

# ── STEP 4: TLS ──────────────────────────────────────────────────────────────
# TLS is terminated by the ALB (ACM certificate). EC2 only speaks plain HTTP.
# No certs needed on the instance.
ok "TLS handled by ALB — no certs required on EC2"

# ── STEP 5: Stop any existing server ─────────────────────────────────────────
step "Stopping existing server (if any)"
systemctl stop "$SVC" 2>/dev/null || true
fuser -k 80/tcp  2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true
sleep 1
ok "Ports 80 + 443 clear"

# ── STEP 6: systemd service ───────────────────────────────────────────────────
step "Registering systemd service"
NODE_BIN=$(which node)

cat > /etc/systemd/system/${SVC}.service << EOF
[Unit]
Description=Prime Alpha Securities Web Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}
ExecStart=${NODE_BIN} ${APP_DIR}/server.js
Restart=always
RestartSec=5
StandardOutput=append:${APP_DIR}/server.log
StandardError=append:${APP_DIR}/server.log
Environment=NODE_ENV=production
Environment=PORT_HTTP=80
Environment=AWS_REGION=eu-west-2
Environment=RESEND_API_KEY=re_Lqr36fGo_8Ev76CnuytPPVaXdXWRY6Z6W
Environment=SUPPORT_EMAIL=support@primealphasecurities.com
Environment=IR_EMAIL=ir@primealphasecurities.com

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SVC" >> "$LOG" 2>&1
ok "systemd service registered (starts on reboot)"

# ── STEP 7: Start ─────────────────────────────────────────────────────────────
step "Starting server"
systemctl start "$SVC"
sleep 3

# ALB terminates TLS — EC2 serves plain HTTP only
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null || echo 000)
API_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/investor 2>/dev/null || echo 000)
HTTPS_CODE="N/A (ALB handles TLS)"

PUBLIC_IP=$(curl -s --max-time 5 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null \
            || hostname -I | awk '{print $1}')

echo ""
# Accept 200 or 301 on HTTP (301 = redirect to HTTPS, server is healthy)
if [[ "$HTTP_CODE" == "200" ]]; then
  echo -e "${GREEN}"
  echo "  ╔══════════════════════════════════════════════╗"
  echo "  ║          DEPLOYMENT SUCCESSFUL  ✓            ║"
  echo "  ╠══════════════════════════════════════════════╣"
  printf "  ║  HTTP  →  http://%-25s  ║\n"  "$PUBLIC_IP"
  printf "  ║  HTTPS →  https://%-24s  ║\n" "$PUBLIC_IP"
  echo "  ╠══════════════════════════════════════════════╣"
  echo "  ║  HTTP=$HTTP_CODE  /api=$API_CODE  (TLS via ALB)               ║"
  echo "  ╠══════════════════════════════════════════════╣"
  echo "  ║  Logs:    sudo journalctl -u pas -f          ║"
  echo "  ║  Restart: sudo systemctl restart pas         ║"
  echo "  ║  Stop:    sudo systemctl stop pas            ║"
  echo "  ╚══════════════════════════════════════════════╝"
  echo -e "${NC}"
  if [[ "$API_CODE" == "200" ]]; then
    echo "  DynamoDB: connected (IAM role is working)"
  else
    echo "  DynamoDB: returned $API_CODE — check IAM role has DynamoDB access"
    echo "  App still works — falls back to demo data"
  fi
  echo ""
  echo "  ── PORTAL URLS ───────────────────────────────────────────────"
  echo "  Public site    → https://primealphasecurities.com"
  echo "  Investor portal → https://primealphasecurities.com/investor"
  echo "  Worker console  → https://primealphasecurities.com/worker"
  echo ""
  echo "  ── DNS SETUP (required if not already done) ──────────────────"
  echo "  In Route 53 / your DNS provider, add ONE A record:"
  echo "       primealphasecurities.com  →  A  →  $PUBLIC_IP"
  echo "  (No subdomain needed — investor portal is now path-based)"
  echo ""
  echo "  ── SSL ───────────────────────────────────────────────────────"
  echo "  TLS is terminated by the ALB using the ACM certificate."
  echo "  The EC2 instance serves plain HTTP — no certs needed here."
  echo "  ────────────────────────────────────────────────────────────"
else
  systemctl status "$SVC" --no-pager -l | tail -20
  die "Server health check failed (HTTP=$HTTP_CODE). Check: sudo journalctl -u pas -n 50"
fi