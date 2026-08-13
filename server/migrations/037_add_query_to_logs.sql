-- server/migrations/037_add_query_to_logs.sql
-- Migration: Add a query column to logs so search requests can be recorded
-- as their own action alongside playback events.
-- Date: 2026-08-13
--
-- Nullable, no default — only rows with action = 'search' populate it;
-- existing 'stream' rows leave it null. See
-- docs/superpowers/specs/2026-08-13-search-query-logging-design.md.

ALTER TABLE logs ADD COLUMN IF NOT EXISTS query text;
