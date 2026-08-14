-- Migration: Add FK constraint from tracks.media_file_id to media_files.id
-- Date: 2026-08-14
--
-- Makes the "a media_files row can't be deleted while a track still
-- references it" invariant a hard database guarantee, not just an
-- application-level convention. This is the backstop underneath the
-- reference-counted delete checks added in admin.ts's album/artist delete
-- cascades — those checks give a clean skip; this constraint is what
-- prevents any other code path (present or future) from silently
-- orphaning a track's media_file_id.
--
-- Safe to add without a backfill: unlike a uniqueness constraint on
-- media_files.file_hash (which would fail against pre-existing duplicate
-- rows), this FK only requires that every non-null tracks.media_file_id
-- currently points at a real row — true today (confirmed via a zero-count
-- orphan check before writing this migration).

ALTER TABLE tracks
  ADD CONSTRAINT tracks_media_file_id_fkey
  FOREIGN KEY (media_file_id) REFERENCES media_files(id)
  ON DELETE RESTRICT;
