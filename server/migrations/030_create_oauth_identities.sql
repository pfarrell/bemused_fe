-- server/migrations/030_create_oauth_identities.sql
-- Migration: Create oauth_identities table
-- Date: 2026-07-29
--
-- Links a bemused user to an external OAuth provider identity (Google,
-- sharing recall's existing OAuth client — see
-- docs/superpowers/specs/2026-07-29-google-oauth-shared-client-design.md).
-- One user has at most one identity per provider; one provider identity
-- points at exactly one user.

CREATE TABLE IF NOT EXISTS oauth_identities (
  id               SERIAL PRIMARY KEY,
  provider         TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email            TEXT NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_identities_user_id ON oauth_identities(user_id);

COMMENT ON TABLE oauth_identities IS 'External OAuth provider identities linked to a bemused user (e.g. Google). One row per provider per user.';
