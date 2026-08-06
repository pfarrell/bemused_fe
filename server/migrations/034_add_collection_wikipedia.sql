-- server/migrations/034_add_collection_wikipedia.sql
-- Migration: Add optional Wikipedia title override to collections
-- Date: 2026-08-06
--
-- Collections are user-curated (not canonical entities like artists/albums),
-- so this is manual-only: no code guesses a Wikipedia title from the
-- collection name — only an explicit override set here is ever looked up.

ALTER TABLE collections ADD COLUMN wikipedia character varying;
