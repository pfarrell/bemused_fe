-- server/migrations/035_create_album_stubs.sql
-- Migration: Add album_stubs table for collection placeholder entries
-- Date: 2026-08-08
--
-- A stub marks an album the user knows belongs somewhere (in a specific
-- collection, or eventually a general "want to acquire" list) but doesn't
-- yet have in their library. Deliberately NOT a row in `albums` — see
-- docs/superpowers/specs/2026-08-08-album-stubs-design.md for why: albums
-- rows require a real, NOT NULL artist_id, and reusing albums would need
-- exclusion filters added to every album-listing query forever (the
-- _Singles pseudo-album already shows how fragile that pattern is).

CREATE TABLE album_stubs (
  id            SERIAL PRIMARY KEY,
  title         character varying NOT NULL,
  artist_name   character varying,
  user_id       integer REFERENCES users(id) ON DELETE SET NULL,
  collection_id integer REFERENCES collections(id) ON DELETE CASCADE,
  "order"       integer,
  created_at    timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at    timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_album_stubs_collection_id ON album_stubs (collection_id);
