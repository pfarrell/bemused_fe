-- Migration: Add source and similarity to artist_relations
-- source: 'manual' | 'lastfm' | 'listenbrainz' | 'musicbrainz'
-- similarity: 0.0–1.0, null for manual/musicbrainz relations

ALTER TABLE artist_relations
  ADD COLUMN IF NOT EXISTS source     VARCHAR(20) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS similarity NUMERIC(5,4);

CREATE INDEX IF NOT EXISTS idx_artist_relations_source ON artist_relations(source);
