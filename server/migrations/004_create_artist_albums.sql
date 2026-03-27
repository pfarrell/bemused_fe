-- Migration: Create artist_albums many-to-many relationship
-- Date: 2026-03-26
-- Purpose: Allow multiple artists per album while keeping albums.artist_id as primary artist

-- Create the join table for many-to-many relationship between artists and albums
CREATE TABLE IF NOT EXISTS artist_albums (
  id SERIAL PRIMARY KEY,
  artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'primary',
  "order" INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(artist_id, album_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_artist_albums_album_order ON artist_albums(album_id, "order");
CREATE INDEX IF NOT EXISTS idx_artist_albums_artist_id ON artist_albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_albums_role ON artist_albums(role);

-- Add check constraint for valid roles
ALTER TABLE artist_albums ADD CONSTRAINT check_artist_albums_role
  CHECK (role IN ('primary', 'compilation', 'featured', 'guest'));

COMMENT ON TABLE artist_albums IS 'Many-to-many relationship between artists and albums with role-based relationships';
COMMENT ON COLUMN artist_albums.artist_id IS 'Artist ID reference';
COMMENT ON COLUMN artist_albums.album_id IS 'Album ID reference';
COMMENT ON COLUMN artist_albums.role IS 'Artist role: primary, compilation, featured, guest';
COMMENT ON COLUMN artist_albums."order" IS 'Display order for multiple artists on same album';

-- Fix orphaned albums: set albums with invalid artist_id to Various Artists (id 161)
UPDATE albums
SET artist_id = 161
WHERE artist_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM artists WHERE artists.id = albums.artist_id);

-- Migrate existing data: populate artist_albums from albums.artist_id
-- Only migrate albums that have valid artist references
INSERT INTO artist_albums (artist_id, album_id, role, "order", created_at)
SELECT a.artist_id, a.id, 'primary', 1, a.created_at
FROM albums a
WHERE a.artist_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM artists WHERE artists.id = a.artist_id)
ON CONFLICT (artist_id, album_id) DO NOTHING;

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

-- Function: Automatically create primary artist_albums record when album is inserted
CREATE OR REPLACE FUNCTION sync_artist_albums_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert the primary artist relationship
  INSERT INTO artist_albums (artist_id, album_id, role, "order", created_at)
  VALUES (NEW.artist_id, NEW.id, 'primary', 1, NEW.created_at)
  ON CONFLICT (artist_id, album_id) DO UPDATE
    SET role = 'primary', "order" = 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Update primary artist_albums record when albums.artist_id changes
CREATE OR REPLACE FUNCTION sync_artist_albums_on_update()
RETURNS TRIGGER AS $$
DECLARE
  old_primary_id INTEGER;
  new_artist_existing_record RECORD;
BEGIN
  -- Only act if artist_id actually changed
  IF OLD.artist_id IS DISTINCT FROM NEW.artist_id THEN

    -- Find the current primary artist_albums record
    SELECT id INTO old_primary_id
    FROM artist_albums
    WHERE album_id = NEW.id AND role = 'primary'
    LIMIT 1;

    -- Check if new artist already has a relationship with this album
    SELECT * INTO new_artist_existing_record
    FROM artist_albums
    WHERE artist_id = NEW.artist_id AND album_id = NEW.id;

    IF FOUND THEN
      -- New artist already has a relationship: promote it to primary
      UPDATE artist_albums
      SET role = 'primary', "order" = 1
      WHERE id = new_artist_existing_record.id;

      -- Delete the old primary record if it exists
      IF old_primary_id IS NOT NULL THEN
        DELETE FROM artist_albums WHERE id = old_primary_id;
      END IF;
    ELSE
      -- New artist doesn't have a relationship yet
      IF old_primary_id IS NOT NULL THEN
        -- Update existing primary record to point to new artist
        UPDATE artist_albums
        SET artist_id = NEW.artist_id
        WHERE id = old_primary_id;
      ELSE
        -- No primary record exists, create one
        INSERT INTO artist_albums (artist_id, album_id, role, "order", created_at)
        VALUES (NEW.artist_id, NEW.id, 'primary', 1, NEW.updated_at);
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE TRIGGERS
-- ============================================================================

-- Trigger: Sync on INSERT
CREATE TRIGGER trigger_sync_artist_albums_insert
  AFTER INSERT ON albums
  FOR EACH ROW
  EXECUTE FUNCTION sync_artist_albums_on_insert();

-- Trigger: Sync on UPDATE
CREATE TRIGGER trigger_sync_artist_albums_update
  AFTER UPDATE ON albums
  FOR EACH ROW
  EXECUTE FUNCTION sync_artist_albums_on_update();

-- ============================================================================
-- ENSURE albums.artist_id is NOT NULL
-- ============================================================================

-- Add NOT NULL constraint if it doesn't exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'albums'
      AND column_name = 'artist_id'
      AND is_nullable = 'YES'
  ) THEN
    -- First, ensure no NULL values exist (set them to Various Artists if needed)
    UPDATE albums SET artist_id = 161 WHERE artist_id IS NULL;

    -- Then add the NOT NULL constraint
    ALTER TABLE albums ALTER COLUMN artist_id SET NOT NULL;
  END IF;
END $$;

-- Verify data integrity: ensure every album has exactly one primary artist
DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM albums a
  WHERE (
    SELECT COUNT(*) FROM artist_albums aa
    WHERE aa.album_id = a.id AND aa.role = 'primary'
  ) != 1;

  IF bad_count > 0 THEN
    RAISE NOTICE 'Warning: % albums have incorrect primary artist count', bad_count;
  ELSE
    RAISE NOTICE 'Data integrity check passed: all albums have exactly one primary artist';
  END IF;
END $$;
