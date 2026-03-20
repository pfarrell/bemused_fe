#!/bin/bash
set -e

# Configuration
REMOTE_HOST="patf.com"
REMOTE_USER="pfarrell"
REMOTE_PORT="10022"
DEPLOY_BASE="/var/www/bemused-node"
TIMESTAMP=$(date +%Y%m%d%H%M%S)
RELEASE_DIR="${DEPLOY_BASE}/releases/${TIMESTAMP}"
SHARED_DIR="${DEPLOY_BASE}/shared"
CURRENT_DIR="${DEPLOY_BASE}/current"

echo "🚀 Deploying Bemused Node.js API..."

# Build locally
echo "📦 Building TypeScript..."
npm run build

# Create directory structure on remote
echo "📁 Creating remote directories..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${RELEASE_DIR} ${SHARED_DIR}"

# Upload built code and dependencies
echo "📤 Uploading server code..."
rsync -avz --delete \
  -e "ssh -p ${REMOTE_PORT}" \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude 'src' \
  --exclude 'scripts' \
  dist package.json package-lock.json \
  ${REMOTE_USER}@${REMOTE_HOST}:${RELEASE_DIR}/

# Install production dependencies on remote
echo "📚 Installing production dependencies on remote..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "cd ${RELEASE_DIR} && npm ci --omit=dev"

# Check if shared .env exists, warn if not
echo "⚙️  Checking for production .env..."
if ! ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "test -f ${SHARED_DIR}/.env"; then
  echo "⚠️  WARNING: ${SHARED_DIR}/.env does not exist!"
  echo "   You need to create it with production database credentials."
  echo "   Example content:"
  echo "   BEMUSED_DB=postgres://user:password@localhost:5432/bemused"
  echo "   PORT=3000"
  echo "   BEMUSED_PATH=https://patf.com/bemused"
  echo ""
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Update symlink to new release
echo "🔗 Updating current symlink..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "ln -nfs ${RELEASE_DIR} ${CURRENT_DIR}"

# Note about restarting service
echo ""
echo "⚠️  Manual step required:"
echo "   SSH to the server and run: sudo systemctl restart bemused-api"
echo "   Then check status with: sudo systemctl status bemused-api"
echo ""

# Clean up old releases (keep last 5)
echo "🧹 Cleaning up old releases..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "cd ${DEPLOY_BASE}/releases && ls -t | tail -n +6 | xargs -r rm -rf"

echo ""
echo "✨ Deployment complete!"
echo "   Release: ${TIMESTAMP}"
echo "   API should be available at: https://patf.com/bemused/api"
echo ""
echo "💡 To view logs: ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} 'sudo journalctl -u bemused-api -f'"
