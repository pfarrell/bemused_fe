-- Migration: Generalize album_notes into a polymorphic notes table
-- Date: 2026-07-27
--
-- Extends notes (previously album-only) to also cover tracks and
-- collections, mirroring the existing favorites(target_id, kind) pattern.
-- Existing album notes (live in production) carry over unchanged as
-- kind='album' rows — this is an in-place rename/reshape, not a new table.
--
-- NOT SAFELY REVERSIBLE BY ROLLING BACK TO AN OLDER RELEASE. This repo has
-- no down-migration mechanism (server/scripts/run-migrations.js only
-- applies forward), and unlike most migrations here this one is not
-- additive: it renames and reshapes a table with real production data
-- rather than adding alongside it. Once this migration has run, any older
-- backend release that still queries `album_notes` (or `notes.album_id`)
-- will fail with "relation \"album_notes\" does not exist" — there is no
-- automatic fallback. If a rollback to a pre-029 release is ever needed:
--   1. Prefer rolling FORWARD to a fixed release instead of back, or
--   2. Manually revert by hand: rename `notes` back to `album_notes`,
--      rename `target_id` back to `album_id`, and drop the `kind` column
--      (this discards any track/collection notes created after 029 ran).

ALTER TABLE album_notes RENAME TO notes;
ALTER TABLE notes RENAME COLUMN album_id TO target_id;
ALTER TABLE notes ADD COLUMN kind TEXT NOT NULL DEFAULT 'album';
ALTER TABLE notes ALTER COLUMN kind DROP DEFAULT;

DROP INDEX IF EXISTS idx_album_notes_album_id;
CREATE INDEX idx_notes_kind_target_id ON notes(kind, target_id);

COMMENT ON TABLE notes IS 'Association between a bemused entity (album/track/collection, per kind) and a Recall note item. Content lives only in Recall — this table has no content column by design.';
COMMENT ON COLUMN notes.kind IS 'Entity type this note is attached to: album | track | collection.';
COMMENT ON COLUMN notes.target_id IS 'ID of the entity (album/track/collection) this note is attached to, per kind. No FK, matching the existing repo-wide convention.';
