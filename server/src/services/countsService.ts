import { Kysely, sql } from 'kysely'
import { db, Database } from '../db/database.js'

export function createCountsService(db: Kysely<Database>) {
  return {
    async trackCountsByAlbumIds(albumIds: number[]): Promise<Map<number, number>> {
      if (albumIds.length === 0) return new Map()

      const rows = await db
        .selectFrom('tracks')
        .select(['album_id', sql<string>`count(*)`.as('count')])
        .where('album_id', 'in', albumIds)
        .where('approved', '=', true)
        .groupBy('album_id')
        .execute()

      return new Map(rows.map((r) => [r.album_id as number, parseInt(r.count, 10)]))
    },

    async albumCountsByArtistIds(artistIds: number[]): Promise<Map<number, number>> {
      if (artistIds.length === 0) return new Map()

      const rows = await db
        .selectFrom('albums')
        .select(['artist_id', sql<string>`count(*)`.as('count')])
        .where('artist_id', 'in', artistIds)
        .groupBy('artist_id')
        .execute()

      return new Map(rows.map((r) => [r.artist_id as number, parseInt(r.count, 10)]))
    },

    async trackCountsByPlaylistIds(playlistIds: number[]): Promise<Map<number, number>> {
      if (playlistIds.length === 0) return new Map()

      const rows = await db
        .selectFrom('playlist_tracks')
        .select(['playlist_id', sql<string>`count(*)`.as('count')])
        .where('playlist_id', 'in', playlistIds)
        .groupBy('playlist_id')
        .execute()

      return new Map(rows.map((r) => [r.playlist_id as number, parseInt(r.count, 10)]))
    },

    async albumCountsByCollectionIds(collectionIds: number[]): Promise<Map<number, number>> {
      if (collectionIds.length === 0) return new Map()

      const rows = await db
        .selectFrom('collection_albums')
        .select(['collection_id', sql<string>`count(*)`.as('count')])
        .where('collection_id', 'in', collectionIds)
        .groupBy('collection_id')
        .execute()

      return new Map(rows.map((r) => [r.collection_id as number, parseInt(r.count, 10)]))
    },
  }
}

export const countsService = createCountsService(db)
