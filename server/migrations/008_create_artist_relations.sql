-- Migration: Create artist_relations symmetric many-to-many
-- Date: 2026-03-30

CREATE TABLE IF NOT EXISTS artist_relations (
  id SERIAL PRIMARY KEY,
  artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  related_artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(artist_id, related_artist_id),
  CHECK (artist_id != related_artist_id)
);

CREATE INDEX IF NOT EXISTS idx_artist_relations_artist_id ON artist_relations(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_relations_related_artist_id ON artist_relations(related_artist_id);

