#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: npm run db:restore -- <snapshot-file>"
  echo ""
  echo "Available snapshots:"
  ls snapshots/*.sql 2>/dev/null | sort -r | head -10 || echo "  (none yet — run npm run db:snapshot first)"
  exit 1
fi

echo "Restoring $1 into bemused_dev..."
psql bemused_dev < "$1"
echo "✅ Restored from $1"
