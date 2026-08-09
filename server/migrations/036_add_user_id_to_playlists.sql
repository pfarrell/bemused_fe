-- server/migrations/036_add_user_id_to_playlists.sql
-- Migration: Add user_id ownership column to playlists, and backfill any
-- ownerless playlists/collections to patf (id 1).
-- Date: 2026-08-09
--
-- collections already has a user_id column; playlists never got one, even
-- though the Kysely PlaylistTable type in server/src/db/database.ts already
-- declares `user_id: number | null` — this migration catches the schema up
-- to the type. See docs/superpowers/specs/2026-08-09-playlist-collection-access-design.md.

ALTER TABLE playlists ADD COLUMN user_id integer;

UPDATE playlists SET user_id = 1 WHERE user_id IS NULL;
UPDATE collections SET user_id = 1 WHERE user_id IS NULL;
