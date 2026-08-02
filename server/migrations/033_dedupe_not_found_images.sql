-- server/migrations/033_dedupe_not_found_images.sql
-- Migration: Prevent duplicate "not_found" placeholder rows in images
-- Date: 2026-08-02
--
-- coverArtArchive.ts and fanart.ts each insert a status='not_found' row when
-- an external lookup (Cover Art Archive / Fanart.tv) has nothing for a given
-- MBID, so future runs don't need to re-query. These lookups are fired
-- non-blocking, once per uploaded track rather than once per album/artist
-- (server/src/workers/queue-handler.ts), so an album with N tracks can fire
-- N concurrent not_found inserts for the same album — each shows up in the
-- admin UI as a blank/broken image tile with no backing file.
--
-- A partial unique index lets the app use ON CONFLICT DO NOTHING to make
-- the insert idempotent regardless of how many concurrent callers race.
-- Duplicates must be collapsed BEFORE the index is created, or the index
-- build itself fails against existing duplicate keys.

-- Collapse any duplicates that already exist, keeping the oldest row.
DELETE FROM images a USING images b
WHERE a.status = 'not_found' AND b.status = 'not_found'
  AND a.album_id IS NOT NULL AND a.album_id = b.album_id AND a.source = b.source
  AND a.id > b.id;

DELETE FROM images a USING images b
WHERE a.status = 'not_found' AND b.status = 'not_found'
  AND a.artist_id IS NOT NULL AND a.artist_id = b.artist_id AND a.source = b.source
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_images_album_not_found
  ON images(album_id, source)
  WHERE status = 'not_found' AND album_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_images_artist_not_found
  ON images(artist_id, source)
  WHERE status = 'not_found' AND artist_id IS NOT NULL;
