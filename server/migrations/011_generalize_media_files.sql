-- Migration: Generalize media_files entity link (track_id -> entity_id/entity_type)
-- Date: 2026-04-01

ALTER TABLE media_files ADD COLUMN IF NOT EXISTS entity_id INTEGER;
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);

-- Migrate existing track associations
UPDATE media_files
SET entity_id = track_id, entity_type = 'track'
WHERE track_id IS NOT NULL;

-- Set discriminator for existing audio files that have a track link
UPDATE media_files
SET discriminator = 'track'
WHERE track_id IS NOT NULL AND (discriminator IS NULL OR discriminator = '');

CREATE INDEX IF NOT EXISTS idx_media_files_entity ON media_files(entity_type, entity_id);

-- Note: track_id column is kept for now as a safety net and dropped in a future migration
-- once all code is confirmed to use entity_id instead.

INSERT INTO schema_migrations (version) VALUES ('011_generalize_media_files')
ON CONFLICT (version) DO NOTHING;
