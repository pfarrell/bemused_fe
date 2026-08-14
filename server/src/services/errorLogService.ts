import { Kysely } from 'kysely'
import { db, Database } from '../db/database.js'

interface NewErrorLogEntry {
  source: string
  message: string
  context?: string | null
}

export function createErrorLogService(db: Kysely<Database>) {
  return {
    // Never throws — a logging failure must not break the caller. Every
    // instrumentation call site in this codebase relies on that guarantee
    // and does not wrap this call in its own try/catch.
    async record(entry: NewErrorLogEntry): Promise<void> {
      try {
        await db
          .insertInto('error_log')
          .values({
            source: entry.source,
            message: entry.message,
            context: entry.context ?? null,
          })
          .execute()
      } catch (err) {
        console.error('Failed to write to error_log:', err)
      }
    },

    async countAll(source?: string) {
      let query = db.selectFrom('error_log').select(db.fn.count('id').as('count'))
      if (source) query = query.where('source', '=', source)
      return query.executeTakeFirst()
    },

    async listPage(limit: number, offset: number, source?: string) {
      let query = db.selectFrom('error_log').selectAll()
      if (source) query = query.where('source', '=', source)
      return query
        .orderBy('id', 'desc')
        .limit(limit)
        .offset(offset)
        .execute()
    },
  }
}

export const errorLogService = createErrorLogService(db)
