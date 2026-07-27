import { Kysely } from 'kysely'
import { db, Database } from '../db/database.js'

export function createAlbumNotesService(db: Kysely<Database>) {
  return {
    async getConnection(userId: number) {
      return db
        .selectFrom('user_recall_tokens')
        .selectAll()
        .where('user_id', '=', userId)
        .executeTakeFirst()
    },

    async saveConnection(userId: number, encryptedToken: string) {
      await db
        .insertInto('user_recall_tokens')
        .values({ user_id: userId, recall_token: encryptedToken })
        .onConflict((oc) => oc.column('user_id').doUpdateSet({ recall_token: encryptedToken }))
        .execute()
    },

    async deleteConnection(userId: number) {
      await db.deleteFrom('user_recall_tokens').where('user_id', '=', userId).execute()
    },

    async listNotesByAlbumId(albumId: number) {
      return db
        .selectFrom('album_notes')
        .innerJoin('users', 'users.id', 'album_notes.author_user_id')
        .select([
          'album_notes.id as id',
          'album_notes.recall_item_id as recall_item_id',
          'album_notes.author_user_id as author_id',
          'users.username as author_username',
          'album_notes.created_at as created_at',
        ])
        .where('album_notes.album_id', '=', albumId)
        .orderBy('album_notes.created_at', 'asc')
        .execute()
    },

    async createNote(albumId: number, authorUserId: number, recallItemId: string) {
      return db
        .insertInto('album_notes')
        .values({ album_id: albumId, author_user_id: authorUserId, recall_item_id: recallItemId })
        .returningAll()
        .executeTakeFirstOrThrow()
    },

    async findNoteById(noteId: number) {
      return db
        .selectFrom('album_notes')
        .selectAll()
        .where('id', '=', noteId)
        .executeTakeFirst()
    },

    async deleteNote(noteId: number) {
      await db.deleteFrom('album_notes').where('id', '=', noteId).execute()
    },
  }
}

export const albumNotesService = createAlbumNotesService(db)
