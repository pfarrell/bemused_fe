-- Migration: Add MusicBrainz IDs to albums and artists
-- Date: 2026-04-01

ALTER TABLE albums ADD COLUMN IF NOT EXISTS musicbrainz_id VARCHAR(36);
ALTER TABLE albums ADD COLUMN IF NOT EXISTS mbid_confidence NUMERIC(3,2);
ALTER TABLE albums ADD COLUMN IF NOT EXISTS mbid_status VARCHAR(20) DEFAULT 'unmatched';

ALTER TABLE artists ADD COLUMN IF NOT EXISTS musicbrainz_id VARCHAR(36);
ALTER TABLE artists ADD COLUMN IF NOT EXISTS mbid_confidence NUMERIC(3,2);
ALTER TABLE artists ADD COLUMN IF NOT EXISTS mbid_status VARCHAR(20) DEFAULT 'unmatched';

CREATE INDEX IF NOT EXISTS idx_albums_mbid ON albums(musicbrainz_id) WHERE musicbrainz_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_albums_mbid_status ON albums(mbid_status);
CREATE INDEX IF NOT EXISTS idx_artists_mbid ON artists(musicbrainz_id) WHERE musicbrainz_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artists_mbid_status ON artists(mbid_status);

INSERT INTO schema_migrations (version) VALUES ('010_add_musicbrainz_ids')
ON CONFLICT (version) DO NOTHING;
