// server/src/services/notesService.ts
import { Kysely } from 'kysely'
import { db, Database } from '../db/database.js'

export function createNotesService(db: Kysely<Database>) {
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

    async listNotesByTarget(kind: string, targetId: number) {
      return db
        .selectFrom('notes')
        .innerJoin('users', 'users.id', 'notes.author_user_id')
        .select([
          'notes.id as id',
          'notes.recall_item_id as recall_item_id',
          'notes.author_user_id as author_id',
          'users.username as author_username',
          'notes.created_at as created_at',
        ])
        .where('notes.kind', '=', kind)
        .where('notes.target_id', '=', targetId)
        .orderBy('notes.created_at', 'asc')
        .execute()
    },

    async createNote(kind: string, targetId: number, authorUserId: number, recallItemId: string) {
      return db
        .insertInto('notes')
        .values({ kind, target_id: targetId, author_user_id: authorUserId, recall_item_id: recallItemId })
        .returningAll()
        .executeTakeFirstOrThrow()
    },

    async findNoteById(noteId: number) {
      return db
        .selectFrom('notes')
        .selectAll()
        .where('id', '=', noteId)
        .executeTakeFirst()
    },

    async deleteNote(noteId: number) {
      await db.deleteFrom('notes').where('id', '=', noteId).execute()
    },
  }
}

export const notesService = createNotesService(db)
