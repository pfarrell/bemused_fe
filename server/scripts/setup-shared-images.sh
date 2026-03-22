#!/bin/bash
# One-time setup script to link shared/public/images to the nginx-served images location
# This follows the same pattern as the old Ruby Capistrano deployment

set -e

REMOTE_HOST="patf.com"
REMOTE_USER="pfarrell"
REMOTE_PORT="10022"
SHARED_DIR="/var/www/bemused-node/shared"
NGINX_IMAGES_DIR="/var/www/bemused/shared/public/images"

echo "🔗 Setting up shared images directory symlink..."
echo ""
echo "This will create a symlink from:"
echo "  ${SHARED_DIR}/public/images"
echo "to the nginx-served location:"
echo "  ${NGINX_IMAGES_DIR}"
echo ""
echo "This matches the Capistrano setup from the Ruby app where:"
echo "  - /var/www/bemused/shared/public/images is served by nginx at patf.net/images"
echo "  - /var/www/bemused-node/shared/public/images will link to the same location"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 1
fi

echo "📁 Creating shared directory structure..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${SHARED_DIR}/public"

echo "🔗 Creating symlink to nginx-served images..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "ln -nfs ${NGINX_IMAGES_DIR} ${SHARED_DIR}/public/images"

echo ""
echo "✅ Shared images symlink created!"
echo ""
echo "Verification:"
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "ls -la ${SHARED_DIR}/public/"
echo ""
echo "Now when you deploy, the release's public/images will link to shared/public/images,"
echo "which links to the nginx-served location at ${NGINX_IMAGES_DIR}"
echo ""
