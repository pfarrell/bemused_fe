-- Migration: Add upload queue table and file hash column
-- Date: 2026-03-21

-- Add file_hash column to media_files for deduplication
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS file_hash VARCHAR(32);
CREATE INDEX IF NOT EXISTS idx_media_files_file_hash ON media_files(file_hash);

-- Create upload_queue table for background processing
CREATE TABLE IF NOT EXISTS upload_queue (
  id SERIAL PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Upload metadata from form
  artist_name VARCHAR(255),
  artist_id INTEGER,
  album_name VARCHAR(255),
  album_id INTEGER,
  genre VARCHAR(100),
  track_pad INTEGER DEFAULT 0,

  -- File information
  file_path VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_hash VARCHAR(32) NOT NULL,
  file_size BIGINT,

  -- Album art
  album_art_path VARCHAR(500),
  album_art_url TEXT,

  -- Processing results
  track_id INTEGER REFERENCES tracks(id),
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_upload_queue_status ON upload_queue(status);
CREATE INDEX IF NOT EXISTS idx_upload_queue_created_at ON upload_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_upload_queue_file_hash ON upload_queue(file_hash);

COMMENT ON TABLE upload_queue IS 'Queue for background processing of uploaded audio files';
COMMENT ON COLUMN upload_queue.status IS 'pending, processing, completed, or failed';
COMMENT ON COLUMN upload_queue.track_pad IS 'Offset to add to track numbers (for multi-disc albums)';
COMMENT ON COLUMN upload_queue.file_hash IS 'MD5 hash for deduplication';
