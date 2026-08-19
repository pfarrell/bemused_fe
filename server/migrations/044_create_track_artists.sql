-- server/migrations/044_create_track_artists.sql
-- Migration: Create track_artists join table for track-level collaborators
-- Date: 2026-08-18
--
-- tracks.artist_id remains the sole source of truth for a track's primary
-- artist (it deliberately has no FK constraint — see CLAUDE.md's note on
-- artist-merge/stub-deletion not reassigning it). This table holds only
-- *additional* credited artists (featured/guest/collaborator), mirroring
-- artist_albums' non-primary roles at the track level. Unlike
-- tracks.artist_id/albums.artist_id, this table's artist_id DOES get a real
-- FK with ON DELETE CASCADE — deleting or merging away an artist who is a
-- collaborator on some track will silently delete those track_artists rows.
-- This is intentionally more correct than the direct-column orphaning
-- behavior, but note it here for whoever next touches the artist
-- merge/stub-deletion code in server/src/routes/admin.ts: this table exists
-- and cascades on artist deletion, unlike tracks.artist_id.

CREATE TABLE track_artists (
  id SERIAL PRIMARY KEY,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('featured', 'guest', 'collaborator')),
  "order" INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (track_id, artist_id)
);

COMMENT ON TABLE track_artists IS 'Many-to-many relationship between tracks and additional credited (non-primary) artists';
