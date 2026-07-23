-- Migration: Fix f_unaccent schema-qualification and replace dead trigram indexes with working GIN indexes
-- Date: 2026-07-23
--
-- f_unaccent() called unaccent() unqualified. Since Postgres 15, CREATE INDEX/REINDEX/ANALYZE
-- run with a restricted search_path that excludes `public` (CVE-2018-1058 hardening), so any
-- attempt to build an index on an expression using unqualified unaccent() fails outright with
-- "function unaccent(text) does not exist". This is why idx_trgm_unaccent_album_title/
-- artist_name/track_title ended up as plain B-tree indexes (useless for ILIKE '%...%' or
-- trigram similarity) instead of the GIN indexes they were meant to be, and why
-- idx_artists_name_trgm (a real GIN index, but without unaccent) never matched the query's
-- f_unaccent(lower(...)) expression. Net effect: every fuzzy/exact search has always done a
-- full sequential scan.

CREATE OR REPLACE FUNCTION public.f_unaccent(text)
  RETURNS text
  LANGUAGE plpgsql
  IMMUTABLE STRICT
AS $function$
      BEGIN
        RETURN public.unaccent($1);
      END;
      $function$;

DROP INDEX IF EXISTS idx_trgm_unaccent_album_title;
DROP INDEX IF EXISTS idx_trgm_unaccent_artist_name;
DROP INDEX IF EXISTS idx_trgm_unaccent_track_title;
DROP INDEX IF EXISTS idx_artists_name_trgm;

CREATE INDEX idx_gin_trgm_unaccent_album_title ON albums USING gin (f_unaccent(lower(title)) gin_trgm_ops);
CREATE INDEX idx_gin_trgm_unaccent_artist_name ON artists USING gin (f_unaccent(lower(name)) gin_trgm_ops);
CREATE INDEX idx_gin_trgm_unaccent_track_title ON tracks USING gin (f_unaccent(lower(title)) gin_trgm_ops);
CREATE INDEX idx_gin_trgm_unaccent_playlist_name ON playlists USING gin (f_unaccent(lower(name)) gin_trgm_ops);
CREATE INDEX idx_gin_trgm_unaccent_collection_name ON collections USING gin (f_unaccent(lower(name)) gin_trgm_ops);
