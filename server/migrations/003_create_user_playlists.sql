-- Migration: Create user_playlists many-to-many relationship
-- Date: 2026-03-26

-- Create the join table for many-to-many relationship between users and playlists
CREATE TABLE IF NOT EXISTS user_playlists (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'owner',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, playlist_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_playlists_user_id ON user_playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_playlists_playlist_id ON user_playlists(playlist_id);
CREATE INDEX IF NOT EXISTS idx_user_playlists_role ON user_playlists(role);

-- Migrate existing playlist ownership from playlists.user_id to user_playlists
-- This handles existing data if playlists have a user_id column
DO $$
BEGIN
  -- Check if user_id column exists in playlists table
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='playlists' AND column_name='user_id') THEN

    -- Migrate existing ownership data
    INSERT INTO user_playlists (user_id, playlist_id, role, created_at)
    SELECT user_id, id, 'owner', created_at
    FROM playlists
    WHERE user_id IS NOT NULL
    ON CONFLICT (user_id, playlist_id) DO NOTHING;

  END IF;
END $$;

COMMENT ON TABLE user_playlists IS 'Many-to-many relationship between users and playlists with role-based access';
COMMENT ON COLUMN user_playlists.user_id IS 'User ID reference';
COMMENT ON COLUMN user_playlists.playlist_id IS 'Playlist ID reference';
COMMENT ON COLUMN user_playlists.role IS 'User role for this playlist: owner, editor, viewer';
