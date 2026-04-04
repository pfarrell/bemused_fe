-- Migration: Fix kind for externally-sourced artist relations
-- 'similar' is the kind for algorithmically-found relations (lastfm, listenbrainz)
-- 'related' is reserved for manually-curated relations

UPDATE artist_relations SET kind = 'similar' WHERE source = 'lastfm';
