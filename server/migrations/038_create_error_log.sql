-- server/migrations/038_create_error_log.sql
-- Migration: Create error_log table for server-side error visibility without SSH access
-- Date: 2026-08-13
--
-- Captures failures from upload processing, uncaught HTTP errors, and
-- background external-service lookups (MusicBrainz, Wikipedia, Fanart,
-- Last.fm, ListenBrainz) that previously only went to console output and
-- were otherwise invisible without SSHing into the server. See
-- docs/superpowers/specs/2026-08-13-upload-batching-and-error-log-design.md.

CREATE TABLE IF NOT EXISTS error_log (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  context TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_error_log_source ON error_log(source);
CREATE INDEX IF NOT EXISTS idx_error_log_created_at ON error_log(created_at);
