#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  FriendChat — Production deploy script
#  Usage: bash deploy.sh
#  Requires: Node.js 18+, npm
# ─────────────────────────────────────────────────────────────
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

info "=== FriendChat Deploy ==="

# ── Check Node version ───────────────────────────────────────
NODE_VER=$(node -v 2>/dev/null | cut -c2- | cut -d. -f1)
[ -z "$NODE_VER" ] && error "Node.js not found. Install Node.js 18+ first."
[ "$NODE_VER" -lt 16 ] && error "Node.js 16+ required. Found v$NODE_VER."
info "Node.js v$(node -v) ✓"

# ── Create .env if missing ───────────────────────────────────
if [ ! -f "server/.env" ]; then
  warn "server/.env not found — creating from example"
  cp server/.env.example server/.env
  # Generate a random JWT secret
  SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  sed -i "s/change-me-to-a-long-random-secret-in-production/$SECRET/" server/.env
  warn "JWT_SECRET auto-generated in server/.env — review the file before going live."
fi

# ── Install server deps ──────────────────────────────────────
info "Installing server dependencies..."
cd server && npm install --production --silent
cd ..

# ── Install & build client ───────────────────────────────────
info "Installing client dependencies..."
cd client && npm install --legacy-peer-deps --silent
info "Building React app..."
npm run build
cd ..

info "Build complete ✓"

# ── Create logs dir ──────────────────────────────────────────
mkdir -p logs

# ── Start with PM2 (if available) ───────────────────────────
if command -v pm2 &>/dev/null; then
  info "Starting with PM2..."
  pm2 start ecosystem.config.js --env production
  pm2 save
  info "PM2 status:"
  pm2 list
else
  warn "PM2 not found. Install it for production: npm install -g pm2"
  info "Starting directly with Node.js (not recommended for production)..."
  node server/index.js &
fi

echo ""
info "✅ FriendChat is running!"
info "   Open http://localhost:4000 in your browser"
info "   Default admin: admin / Admin1234!"
info "   ⚠️  Change the admin password immediately after first login."
