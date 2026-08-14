-- Migration: Drop unused media_files.track_id column
-- Date: 2026-08-14
--
-- Vestigial from before the media_files.entity_id/entity_type generic
-- pattern was introduced (migration 011_generalize_media_files.sql,
-- 2026-04-01), which itself noted track_id would be dropped "once all
-- code is confirmed to use entity_id instead." That never happened —
-- the codebase instead moved to tracks.media_file_id as the live
-- relationship, never adopting entity_type = 'track' as migration 011
-- anticipated. track_id has been fully dead either way: confirmed no
-- code in server/src reads or writes it, no FK constraint references
-- it, and it's NULL on every existing row.

ALTER TABLE media_files DROP COLUMN IF EXISTS track_id;
