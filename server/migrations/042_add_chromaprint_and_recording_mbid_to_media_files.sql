-- Migration: Add chromaprint fingerprint and recording-level MusicBrainz ID to media_files
-- Date: 2026-08-15
--
-- chromaprint_fingerprint/chromaprint_duration_sec are computed locally via
-- fpcalc (server/src/utils/chromaprint.ts) and used to resolve
-- musicbrainz_recording_id via the AcoustID API (server/src/services/acoustid.ts).
-- Named musicbrainz_recording_id (not musicbrainz_id, unlike artists/albums)
-- because it identifies a MusicBrainz *recording*, a different entity type
-- from the release/artist MBIDs already stored on albums/artists — and to
-- avoid collision if media_files ever gains a non-audio external-ID column
-- for the video/photo rows this table is expected to hold in the future.

ALTER TABLE media_files ADD COLUMN IF NOT EXISTS chromaprint_fingerprint TEXT;
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS chromaprint_duration_sec INTEGER;
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS musicbrainz_recording_id VARCHAR(36);
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS mbid_confidence NUMERIC(3,2);
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS mbid_status VARCHAR(20) DEFAULT 'unmatched';

CREATE INDEX IF NOT EXISTS idx_media_files_recording_mbid ON media_files(musicbrainz_recording_id) WHERE musicbrainz_recording_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_files_mbid_status ON media_files(mbid_status);

COMMENT ON COLUMN media_files.chromaprint_fingerprint IS 'Compressed base64 Chromaprint fingerprint from fpcalc; used to resolve musicbrainz_recording_id via AcoustID and to detect same-recording duplicates across different encodes/rips of the same file_hash-distinct audio';
COMMENT ON COLUMN media_files.musicbrainz_recording_id IS 'MusicBrainz recording MBID resolved via AcoustID lookup of chromaprint_fingerprint — distinct from albums.musicbrainz_id/artists.musicbrainz_id, which identify releases/artists, not recordings';
