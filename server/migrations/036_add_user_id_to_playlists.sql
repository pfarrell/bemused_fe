-- server/migrations/036_add_user_id_to_playlists.sql
-- Migration: Add user_id ownership column to playlists, and backfill any
-- ownerless playlists/collections to patf.
-- Date: 2026-08-09
--
-- collections already has a user_id column; playlists never got one, even
-- though the Kysely PlaylistTable type in server/src/db/database.ts already
-- declares `user_id: number | null` — this migration catches the schema up
-- to the type. See docs/superpowers/specs/2026-08-09-playlist-collection-access-design.md.
--
-- patf's user id is NOT the same across environments (1 in dev, 3 in
-- production, since production's users table doesn't start at 1) — a
-- hardcoded id here passed silently in dev and hit collections' user_id FK
-- constraint in production. Look the id up by username instead.

ALTER TABLE playlists ADD COLUMN user_id integer;

UPDATE playlists SET user_id = (SELECT id FROM users WHERE username = 'patf') WHERE user_id IS NULL;
UPDATE collections SET user_id = (SELECT id FROM users WHERE username = 'patf') WHERE user_id IS NULL;
