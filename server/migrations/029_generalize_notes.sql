-- Migration: Generalize album_notes into a polymorphic notes table
-- Date: 2026-07-27
--
-- Extends notes (previously album-only) to also cover tracks and
-- collections, mirroring the existing favorites(target_id, kind) pattern.
-- Existing album notes (live in production) carry over unchanged as
-- kind='album' rows — this is an in-place rename/reshape, not a new table.

ALTER TABLE album_notes RENAME TO notes;
ALTER TABLE notes RENAME COLUMN album_id TO target_id;
ALTER TABLE notes ADD COLUMN kind TEXT NOT NULL DEFAULT 'album';
ALTER TABLE notes ALTER COLUMN kind DROP DEFAULT;

DROP INDEX IF EXISTS idx_album_notes_album_id;
CREATE INDEX idx_notes_kind_target_id ON notes(kind, target_id);

COMMENT ON TABLE notes IS 'Association between a bemused entity (album/track/collection, per kind) and a Recall note item. Content lives only in Recall — this table has no content column by design.';
COMMENT ON COLUMN notes.kind IS 'Entity type this note is attached to: album | track | collection.';
COMMENT ON COLUMN notes.target_id IS 'ID of the entity (album/track/collection) this note is attached to, per kind. No FK, matching the existing repo-wide convention.';
