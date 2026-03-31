-- Migration: Add kind column to artist_relations
-- Date: 2026-03-30

ALTER TABLE artist_relations ADD COLUMN IF NOT EXISTS kind VARCHAR(50) NOT NULL DEFAULT 'related';
CREATE INDEX IF NOT EXISTS idx_artist_relations_kind ON artist_relations(kind);
