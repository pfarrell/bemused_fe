#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"

cd "$SERVER_DIR"
set -a; source .env; set +a

if [ "$NODE_ENV" != "development" ]; then
  echo "❌ db:reset is only allowed in development (NODE_ENV=$NODE_ENV). Aborting."
  exit 1
fi

MAINTENANCE_URL="${BEMUSED_DB%/*}/postgres"

ARTIST_COUNT=$(psql "$BEMUSED_DB" -t -A -c "SELECT COUNT(*) FROM artists" 2>/dev/null || echo "0")
if [ "$ARTIST_COUNT" -gt 100 ]; then
  echo "❌ Database has $ARTIST_COUNT artists (limit: 100). This looks like real data. Aborting."
  exit 1
fi

echo "⚠️  This will DROP and recreate bemused_dev. All data will be lost."
read -p "Continue? (y/N) " -r
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

echo "🗑️  Dropping bemused_dev..."
psql "$MAINTENANCE_URL" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'bemused_dev' AND pid <> pg_backend_pid()" > /dev/null
psql "$MAINTENANCE_URL" -c "DROP DATABASE IF EXISTS bemused_dev" > /dev/null
echo "   ✅ Dropped"

echo ""
bash "$SCRIPT_DIR/setup-local-dev.sh"
