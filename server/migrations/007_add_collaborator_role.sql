-- Migration: Add 'collaborator' to artist_albums role constraint

ALTER TABLE artist_albums DROP CONSTRAINT check_artist_albums_role;

ALTER TABLE artist_albums ADD CONSTRAINT check_artist_albums_role
  CHECK (role IN ('primary', 'compilation', 'featured', 'guest', 'collaborator'));

INSERT INTO schema_migrations (version) VALUES ('007_add_collaborator_role')
ON CONFLICT (version) DO NOTHING;
