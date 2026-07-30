-- server/migrations/032_make_favorites_usable.sql
-- Migration: Make the favorites table usable
-- Date: 2026-07-30
--
-- The favorites table has existed since the initial schema but was never
-- wired to any route or frontend code. Two gaps block using it:
--
-- 1. No uniqueness constraint — toggling a favorite on/off repeatedly would
--    pile up duplicate rows instead of being idempotent.
-- 2. No DEFAULT on created_at/updated_at, even though the Kysely
--    FavoriteTable type (server/src/db/database.ts) already declares both as
--    insert-type `never`, i.e. assumes the DB fills them in. Without a
--    default, an insert that omits them (which the type forces) would write
--    NULL timestamps, breaking "most recently favorited first" ordering.

ALTER TABLE favorites ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE favorites ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE favorites ADD CONSTRAINT favorites_user_kind_target_unique UNIQUE (user_id, kind, target_id);
