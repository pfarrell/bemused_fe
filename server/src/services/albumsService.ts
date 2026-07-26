import { Kysely, sql } from 'kysely'
import { db, Database } from '../db/database.js'

export function createAlbumsService(db: Kysely<Database>) {
  return {
    async randomByTag(tag: string, size: number) {
      return sql<any>`
        WITH eligible_album_ids AS (
          SELECT DISTINCT al.id
          FROM albums al
          INNER JOIN tracks t ON t.album_id = al.id AND t.approved = true
          INNER JOIN albums_tags at ON at.album_id = al.id
          INNER JOIN tags tg ON tg.id = at.tag_id AND tg.name = ${tag}
          WHERE al.image_path IS NOT NULL AND al.image_path != ''
        ),
        random_ids AS (
          SELECT id FROM eligible_album_ids ORDER BY random() LIMIT ${size}
        )
        SELECT al.id, al.title, al.image_path,
               ar.id AS artist_id, ar.name AS artist_name,
               EXISTS (
                 SELECT 1 FROM artist_albums caa WHERE caa.album_id = al.id AND caa.role = 'collaborator'
               ) AS has_collaborators
        FROM albums al
        INNER JOIN random_ids r ON al.id = r.id
        INNER JOIN artists ar ON ar.id = al.artist_id
      `.execute(db)
    },

    async randomAll(size: number) {
      return sql<any>`
        WITH eligible_album_ids AS (
          SELECT DISTINCT al.id
          FROM albums al
          INNER JOIN tracks t ON t.album_id = al.id AND t.approved = true
          WHERE al.image_path IS NOT NULL AND al.image_path != ''
        ),
        random_ids AS (
          SELECT id FROM eligible_album_ids ORDER BY random() LIMIT ${size}
        )
        SELECT al.id, al.title, al.image_path,
               ar.id AS artist_id, ar.name AS artist_name,
               EXISTS (
                 SELECT 1 FROM artist_albums caa WHERE caa.album_id = al.id AND caa.role = 'collaborator'
               ) AS has_collaborators
        FROM albums al
        INNER JOIN random_ids r ON al.id = r.id
        INNER JOIN artists ar ON ar.id = al.artist_id
      `.execute(db)
    },

    async findAlbumById(id: number) {
      return db
        .selectFrom('albums')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst()
    },

    async findArtistById(id: number) {
      return db
        .selectFrom('artists')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst()
    },

    async findTracksByAlbumId(albumId: number) {
      return db
        .selectFrom('tracks')
        .leftJoin('artists as track_artist', 'track_artist.id', 'tracks.artist_id')
        .select([
          'tracks.id',
          'tracks.title',
          'tracks.track_number',
          'tracks.duration_sec',
          'tracks.album_id',
          'tracks.artist_id',
          'track_artist.name as artist_name',
          'track_artist.image_path as artist_image_path',
        ])
        .where('tracks.album_id', '=', albumId)
        .where('tracks.approved', '=', true)
        .execute()
    },

    async findSecondaryArtistsByAlbumId(albumId: number) {
      return db
        .selectFrom('artist_albums')
        .innerJoin('artists as sa', 'sa.id', 'artist_albums.artist_id')
        .select([
          'artist_albums.artist_id as id',
          'sa.name',
          'artist_albums.role',
        ])
        .where('artist_albums.album_id', '=', albumId)
        .where('artist_albums.role', '!=', 'primary')
        .orderBy('artist_albums.order', 'asc')
        .execute()
    },

    async findCollectionsByAlbumId(albumId: number) {
      return db
        .selectFrom('collection_albums')
        .innerJoin('collections', 'collections.id', 'collection_albums.collection_id')
        .select([
          'collections.id as id',
          'collections.name as name',
        ])
        .where('collection_albums.album_id', '=', albumId)
        .orderBy('collections.name', 'asc')
        .execute()
    },
  }
}

export const albumsService = createAlbumsService(db)
