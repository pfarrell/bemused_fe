-- Migration: Create images table and migrate existing image_path data
-- Date: 2026-04-01

CREATE TABLE IF NOT EXISTS images (
  id SERIAL PRIMARY KEY,
  album_id INTEGER REFERENCES albums(id) ON DELETE CASCADE,
  artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  source VARCHAR(50) NOT NULL DEFAULT 'manual',
  -- source values: 'manual' | 'cover_art_archive' | 'lastfm'
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  -- status values: 'active' | 'proposed' | 'rejected'
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (album_id IS NOT NULL AND artist_id IS NULL) OR
    (artist_id IS NOT NULL AND album_id IS NULL)
  )
);

-- One primary image per album, one per artist
CREATE UNIQUE INDEX IF NOT EXISTS idx_images_album_primary
  ON images(album_id, is_primary)
  WHERE is_primary = true AND album_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_images_artist_primary
  ON images(artist_id, is_primary)
  WHERE is_primary = true AND artist_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_images_album_id ON images(album_id) WHERE album_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_images_artist_id ON images(artist_id) WHERE artist_id IS NOT NULL;

-- Migrate existing album image_path values into the images + media_files tables
INSERT INTO images (album_id, is_primary, source, status)
SELECT id, true, 'manual', 'active'
FROM albums
WHERE image_path IS NOT NULL AND image_path != '';

INSERT INTO media_files (entity_type, entity_id, discriminator, absolute_path, name, file_type, created_at, updated_at)
SELECT
  'image',
  i.id,
  'image',
  a.image_path,
  a.image_path,
  'image',
  NOW(),
  NOW()
FROM images i
JOIN albums a ON a.id = i.album_id
WHERE i.source = 'manual';

-- Migrate existing artist image_path values
INSERT INTO images (artist_id, is_primary, source, status)
SELECT id, true, 'manual', 'active'
FROM artists
WHERE image_path IS NOT NULL AND image_path != '';

INSERT INTO media_files (entity_type, entity_id, discriminator, absolute_path, name, file_type, created_at, updated_at)
SELECT
  'image',
  i.id,
  'image',
  ar.image_path,
  ar.image_path,
  'image',
  NOW(),
  NOW()
FROM images i
JOIN artists ar ON ar.id = i.artist_id
WHERE i.source = 'manual';

INSERT INTO schema_migrations (version) VALUES ('012_create_images')
ON CONFLICT (version) DO NOTHING;
