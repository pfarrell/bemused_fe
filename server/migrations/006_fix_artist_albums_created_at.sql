-- Migration: Fix artist_albums created_at
-- Backfill NULL values from albums.created_at and fix triggers to use COALESCE

-- Backfill NULLs using the corresponding album's created_at
UPDATE artist_albums aa
SET created_at = COALESCE(a.created_at, CURRENT_TIMESTAMP)
FROM albums a
WHERE aa.album_id = a.id
  AND aa.created_at IS NULL;

-- Catch any remaining NULLs (albums that also had NULL created_at)
UPDATE artist_albums
SET created_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL;

-- Update insert trigger to never write NULL created_at
CREATE OR REPLACE FUNCTION sync_artist_albums_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO artist_albums (artist_id, album_id, role, "order", created_at)
  VALUES (NEW.artist_id, NEW.id, 'primary', 1, COALESCE(NEW.created_at, CURRENT_TIMESTAMP))
  ON CONFLICT (artist_id, album_id) DO UPDATE
    SET role = 'primary', "order" = 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update update trigger to never write NULL created_at
CREATE OR REPLACE FUNCTION sync_artist_albums_on_update()
RETURNS TRIGGER AS $$
DECLARE
  old_primary_id INTEGER;
  new_artist_existing_record RECORD;
BEGIN
  IF OLD.artist_id IS DISTINCT FROM NEW.artist_id THEN

    SELECT id INTO old_primary_id
    FROM artist_albums
    WHERE album_id = NEW.id AND role = 'primary'
    LIMIT 1;

    SELECT * INTO new_artist_existing_record
    FROM artist_albums
    WHERE artist_id = NEW.artist_id AND album_id = NEW.id;

    IF FOUND THEN
      UPDATE artist_albums
      SET role = 'primary', "order" = 1
      WHERE id = new_artist_existing_record.id;

      IF old_primary_id IS NOT NULL THEN
        DELETE FROM artist_albums WHERE id = old_primary_id;
      END IF;
    ELSE
      IF old_primary_id IS NOT NULL THEN
        UPDATE artist_albums
        SET artist_id = NEW.artist_id
        WHERE id = old_primary_id;
      ELSE
        INSERT INTO artist_albums (artist_id, album_id, role, "order", created_at)
        VALUES (NEW.artist_id, NEW.id, 'primary', 1, COALESCE(NEW.updated_at, CURRENT_TIMESTAMP));
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
