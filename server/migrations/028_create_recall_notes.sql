-- Migration: Create user_recall_tokens and album_notes tables
-- Date: 2026-07-27
--
-- Backs album notes with Recall as the content store — bemused stores only
-- the association, never the note content. See the design doc pushed to
-- Recall (folio: "Album Notes via Recall"), not committed to this repo.

CREATE TABLE IF NOT EXISTS user_recall_tokens (
  user_id INTEGER PRIMARY KEY,
  recall_token TEXT NOT NULL,
  connected_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS album_notes (
  id SERIAL PRIMARY KEY,
  album_id INTEGER NOT NULL,
  recall_item_id TEXT NOT NULL,
  author_user_id INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_album_notes_album_id ON album_notes(album_id);

COMMENT ON TABLE user_recall_tokens IS 'Per-bemused-user Recall API token (encrypted at rest), granted via the Recall cli-auth handshake. One row per connected user.';
COMMENT ON COLUMN user_recall_tokens.recall_token IS 'AES-256-GCM encrypted with RECALL_TOKEN_ENCRYPTION_KEY; format iv:authTag:ciphertext, all hex.';
COMMENT ON TABLE album_notes IS 'Association between a bemused album and a Recall note item. Content lives only in Recall — this table has no content column by design.';
