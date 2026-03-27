-- Migration: Fix playlist_tracks order column
-- Date: 2026-03-26
-- Purpose: Ensure all playlist_tracks have proper sequential order values

-- Set default value for order column if not already set
ALTER TABLE playlist_tracks ALTER COLUMN "order" SET DEFAULT 1;

-- Update NULL order values with proper sequential numbers
DO $$
DECLARE
  playlist_rec RECORD;
  track_rec RECORD;
  current_order INTEGER;
BEGIN
  -- For each playlist
  FOR playlist_rec IN SELECT DISTINCT playlist_id FROM playlist_tracks
  LOOP
    current_order := 1;

    -- Order tracks by their current order (nulls last), then by id
    FOR track_rec IN
      SELECT id
      FROM playlist_tracks
      WHERE playlist_id = playlist_rec.playlist_id
      ORDER BY
        CASE WHEN "order" IS NULL THEN 999999 ELSE "order" END ASC,
        id ASC
    LOOP
      -- Update each track with sequential order
      UPDATE playlist_tracks
      SET "order" = current_order
      WHERE id = track_rec.id;

      current_order := current_order + 1;
    END LOOP;
  END LOOP;
END $$;

-- Make order NOT NULL now that all values are set
ALTER TABLE playlist_tracks ALTER COLUMN "order" SET NOT NULL;

-- Verify all playlists have proper ordering
DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM playlist_tracks
  WHERE "order" IS NULL OR "order" < 1;

  IF bad_count > 0 THEN
    RAISE NOTICE 'Warning: % playlist_tracks have invalid order values', bad_count;
  ELSE
    RAISE NOTICE 'All playlist_tracks have valid order values';
  END IF;
END $$;
