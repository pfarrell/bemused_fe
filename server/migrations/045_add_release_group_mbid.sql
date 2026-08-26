-- Migration: Add release-group MusicBrainz ID to albums
-- Date: 2026-08-25
--
-- Stores the MBID of the release-group a matched album's release belongs to,
-- alongside the existing release-level musicbrainz_id. Lets external
-- consumers (Overtone) resolve a link to this album from any release in the
-- same group, not just the one specific edition bemused happened to match.
-- Always derived from whatever release is currently matched — never set
-- independently, so it carries no confidence/status columns of its own.

ALTER TABLE albums ADD COLUMN IF NOT EXISTS release_group_musicbrainz_id VARCHAR(36);

CREATE INDEX IF NOT EXISTS idx_albums_release_group_mbid
  ON albums(release_group_musicbrainz_id) WHERE release_group_musicbrainz_id IS NOT NULL;
