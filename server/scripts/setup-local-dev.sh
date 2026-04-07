#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔧 Setting up bemused local development environment..."
echo ""

# Check .env exists
if [ ! -f "$SERVER_DIR/.env" ]; then
  echo "❌ server/.env not found."
  echo "   Copy server/.env.example to server/.env and fill in your values, then re-run."
  exit 1
fi

# Load .env so credentials are available for all subsequent steps
cd "$SERVER_DIR"
set -a; source .env; set +a

# Create bemused_dev database using credentials from BEMUSED_DB
# Connect to the 'postgres' maintenance DB, then create bemused_dev
echo "📦 Creating bemused_dev database..."
MAINTENANCE_URL="${BEMUSED_DB%/*}/postgres"
if psql "$MAINTENANCE_URL" -c "CREATE DATABASE bemused_dev" > /dev/null 2>&1; then
  echo "   ✅ Created bemused_dev"
else
  # Check if it already exists vs a real error
  if psql "$BEMUSED_DB" -c "SELECT 1" > /dev/null 2>&1; then
    echo "   ℹ️  bemused_dev already exists (skipping)"
  else
    echo "   ❌ Failed to create bemused_dev — check BEMUSED_DB credentials in server/.env"
    exit 1
  fi
fi

# Set up schema and migrations
echo ""
if psql "$BEMUSED_DB" -c "SELECT 1 FROM artists LIMIT 1" > /dev/null 2>&1; then
  # DB already initialized — run any pending migrations
  echo "📊 Running pending migrations..."
  node scripts/run-migrations.js
else
  # Fresh DB — load schema baseline and seed all migration versions as applied
  echo "📊 Loading schema baseline..."
  psql "$BEMUSED_DB" -f schema.sql > /dev/null
  echo "   ✅ Schema loaded"
  echo "   Seeding migration history..."
  for version in 000_init_migrations 001_add_upload_queue_and_file_hash 002_create_users 003_create_user_playlists 004_create_artist_albums 005_fix_playlist_tracks_order 006_fix_artist_albums_created_at 007_add_collaborator_role 008_create_artist_relations 009_add_kind_to_artist_relations 010_add_musicbrainz_ids 011_generalize_media_files 012_create_images 013_add_external_lookups 014_add_source_similarity_to_artist_relations 015_fix_similar_artist_kind 016_all_related_to_similar; do
    psql "$BEMUSED_DB" -c "INSERT INTO schema_migrations (version) VALUES ('$version') ON CONFLICT DO NOTHING" > /dev/null
  done
  echo "   ✅ Migration history seeded"

  # Seed default admin user (patf / pass123)
  echo "   Seeding admin user..."
  node -e "
    import('dotenv/config').then(() => import('bcrypt')).then(async (bcrypt) => {
      const { default: pg } = await import('pg')
      const client = new pg.Client({ connectionString: process.env.BEMUSED_DB })
      await client.connect()
      const hash = await bcrypt.hash('pass123', 10)
      await client.query(
        \`INSERT INTO users (username, password, admin) VALUES ('patf', \$1, true) ON CONFLICT DO NOTHING\`,
        [hash]
      )
      await client.end()
      console.log('   ✅ Admin user created (patf / pass123)')
    }).catch(err => { console.error('   ❌ Failed to seed admin user:', err.message); process.exit(1) })
  "
fi

# Create local music directory
MUSIC_DIR="$HOME/bemused-dev/music"
echo ""
echo "🎵 Creating local music directory..."
mkdir -p "$MUSIC_DIR"
echo "   ✅ $MUSIC_DIR"

# Create snapshots directory
mkdir -p "$SERVER_DIR/snapshots"
echo "   ✅ $SERVER_DIR/snapshots"

# Validate required .env vars
echo ""
echo "🔍 Checking server/.env for required variables..."
REQUIRED_VARS="BEMUSED_DB BEMUSED_UPLOAD_PATH LASTFM_API_KEY FANART_API_KEY"
MISSING=""
for VAR in $REQUIRED_VARS; do
  if ! grep -q "^${VAR}=" "$SERVER_DIR/.env" 2>/dev/null; then
    MISSING="$MISSING\n   ❌ $VAR"
  fi
done

if [ -n "$MISSING" ]; then
  echo -e "   Missing vars:$MISSING"
  echo ""
  echo "   Add them to server/.env and re-run this script."
  exit 1
else
  echo "   ✅ All required vars present"
fi

echo ""
echo "✨ Local dev setup complete!"
echo ""
echo "Start developing (3 terminals):"
echo "   Terminal 1: npm run dev                  (Vite frontend)"
echo "   Terminal 2: cd server && npm run dev      (API server)"
echo "   Terminal 3: cd server && npm run worker   (Queue worker — only when uploading)"
echo ""
echo "Snapshot the DB after adding test data:"
echo "   cd server && npm run db:snapshot"
echo ""
echo "Restore a snapshot:"
echo "   cd server && npm run db:restore -- snapshots/<filename>.sql"
