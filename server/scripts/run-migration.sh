#!/bin/bash
set -e

# Run database migrations
# Usage: ./scripts/run-migration.sh [migration_file.sql]

if [ -z "$BEMUSED_DB" ]; then
  echo "Error: BEMUSED_DB environment variable not set"
  exit 1
fi

# Extract connection details from BEMUSED_DB
# Format: postgres://user:password@host:port/database
DB_URL="$BEMUSED_DB"

MIGRATION_FILE="${1:-migrations/001_add_upload_queue_and_file_hash.sql}"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "Error: Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "Running migration: $MIGRATION_FILE"
echo "Database: $DB_URL"

# Use psql to run the migration
psql "$DB_URL" -f "$MIGRATION_FILE"

echo "Migration completed successfully!"
