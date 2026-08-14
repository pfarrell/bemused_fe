-- Migration: Add is_single flag to upload_queue
-- Date: 2026-08-14
--
-- Drives the upload-time equivalent of the existing "Make Single" admin
-- action: when true, the queue worker routes the track directly into its
-- resolved artist's _Singles pseudo-album instead of doing normal album
-- resolution. No column is needed on `albums` itself — singles are
-- identified purely by the existing `_Singles` title convention (see
-- SINGLES_ALBUM_TITLE), same as the make-single action.

ALTER TABLE upload_queue ADD COLUMN IF NOT EXISTS is_single BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN upload_queue.is_single IS 'Set by the admin at upload time; when true, the worker skips normal album resolution and files the track under its artist''s _Singles pseudo-album instead.';
