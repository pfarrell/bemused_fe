#!/bin/bash
# Helper script to create production .env file on remote server
# Usage: ./scripts/setup-production-env.sh

REMOTE_HOST="patf.com"
REMOTE_USER="pfarrell"
REMOTE_PORT="10022"
SHARED_DIR="/var/www/bemused-node/shared"

echo "🔧 Setting up production .env file..."
echo ""
echo "This script will create ${SHARED_DIR}/.env on the remote server."
echo ""

# Check if .env already exists
if ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "test -f ${SHARED_DIR}/.env"; then
  echo "⚠️  WARNING: ${SHARED_DIR}/.env already exists!"
  read -p "Do you want to overwrite it? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# Prompt for values
echo "Please provide the following values:"
echo ""

read -p "Database connection string (e.g., postgres://user:pass@localhost:5432/bemused): " DB_STRING
read -p "Port for Node.js API [3000]: " PORT
PORT=${PORT:-3000}

# Create the directory
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${SHARED_DIR}"

# Create .env file on remote
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "cat > ${SHARED_DIR}/.env" <<EOF
BEMUSED_DB=${DB_STRING}
PORT=${PORT}
BEMUSED_PATH=https://patf.com/bemused
NODE_ENV=production
EOF

echo ""
echo "✅ Production .env file created at ${SHARED_DIR}/.env"
echo ""
echo "File contents:"
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "cat ${SHARED_DIR}/.env"
