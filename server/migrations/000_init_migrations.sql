-- Migration tracking table
-- This must be the first migration (000_) to track all subsequent migrations

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Record this migration as applied
INSERT INTO schema_migrations (version) VALUES ('000_init_migrations')
ON CONFLICT (version) DO NOTHING;
