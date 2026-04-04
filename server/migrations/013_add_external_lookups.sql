-- Migration: Create external_lookups table
-- Tracks when an entity was last checked against an external service.
-- service values: 'lastfm_similar', 'listenbrainz_similar', 'fanart', 'musicbrainz'
-- result values: 'found', 'not_found', 'error'

CREATE TABLE IF NOT EXISTS external_lookups (
  id          SERIAL PRIMARY KEY,
  entity_type VARCHAR(20)  NOT NULL,
  entity_id   INTEGER      NOT NULL,
  service     VARCHAR(30)  NOT NULL,
  checked_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
  result      VARCHAR(20),
  UNIQUE(entity_type, entity_id, service)
);

CREATE INDEX IF NOT EXISTS idx_external_lookups_entity
  ON external_lookups(entity_type, entity_id);
