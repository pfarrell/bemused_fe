#!/bin/bash
set -eo pipefail

REMOTE_HOST="patf.com"
REMOTE_USER="pfarrell"
REMOTE_PORT="10022"
SHARED_DIR="/var/www/bemused-node/shared"

mkdir -p snapshots
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTFILE="snapshots/prod_${TIMESTAMP}.sql.gz"

echo "📦 Dumping production database over SSH and compressing locally..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} \
  "export \$(cat ${SHARED_DIR}/.env | xargs) && /usr/lib/postgresql/17/bin/pg_dump \"\$BEMUSED_DB\"" \
  | gzip > "$OUTFILE"

SIZE=$(du -h "$OUTFILE" | cut -f1)
echo "✅ Production snapshot saved to $OUTFILE ($SIZE)"
echo ""
echo "This is a read-only backup for safekeeping — nothing is written to"
echo "production or left behind on the remote host. To inspect it or restore"
echo "into LOCAL DEV (never point this at production without a separately"
echo "considered, deliberate restore plan):"
echo "  gunzip -c $OUTFILE | psql bemused_dev"
