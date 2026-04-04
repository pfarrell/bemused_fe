-- Migration: Convert all remaining kind='related' rows to kind='similar'
-- All artist relations were algorithmically sourced (lastfm); none were manually curated.

UPDATE artist_relations SET kind = 'similar' WHERE kind = 'related';
