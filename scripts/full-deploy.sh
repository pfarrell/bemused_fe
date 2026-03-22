#!/bin/bash
set -e

echo "🚀 Full Deploy - Frontend + Backend"
echo ""

# Deploy Backend
echo "📦 Deploying Backend..."
cd server
./node_modules/.bin/tsc
./scripts/deploy.sh
cd ..

echo ""
echo "📦 Deploying Frontend..."
/home/pfarrell/.nvm/versions/node/v23.3.0/bin/npm run build
./scripts/deploy.sh

echo ""
echo "✨ Full deployment complete!"
echo ""
echo "💡 API service was automatically restarted during backend deployment"
