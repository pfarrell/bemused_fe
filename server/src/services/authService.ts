import { Kysely } from 'kysely'
import { db, Database } from '../db/database.js'

export function createAuthService(db: Kysely<Database>) {
  return {
    async findUserById(id: number) {
      return db
        .selectFrom('users')
        .select(['id', 'username', 'email', 'admin', 'default_tag'])
        .where('id', '=', id)
        .executeTakeFirst()
    },

    async userExistsByUsername(username: string) {
      return db
        .selectFrom('users')
        .select('id')
        .where(db.fn('LOWER', ['username']), '=', username.toLowerCase())
        .executeTakeFirst()
    },

    async findUserByEmail(email: string) {
      return db
        .selectFrom('users')
        .select('id')
        .where(db.fn('LOWER', ['email']), '=', email.toLowerCase())
        .executeTakeFirst()
    },

    async findUserForLogin(username: string) {
      return db
        .selectFrom('users')
        .selectAll()
        .where(db.fn('LOWER', ['username']), '=', username.toLowerCase())
        .executeTakeFirst()
    },

    async createUser({ username, password, email }: { username: string; password: string; email: string | null }) {
      return db
        .insertInto('users')
        .values({
          username,
          password,
          email,
          admin: false,
        })
        .returningAll()
        .executeTakeFirst()
    },

    async updateDefaultTag(userId: number, tag: string | null) {
      await db
        .updateTable('users')
        .set({ default_tag: tag, updated_at: new Date().toISOString() })
        .where('id', '=', userId)
        .execute()
    },

    async hasPassword(userId: number): Promise<boolean> {
      const row = await db
        .selectFrom('users')
        .select('password')
        .where('id', '=', userId)
        .executeTakeFirst()
      return row?.password != null
    },

    async setPassword(userId: number, passwordHash: string) {
      await db
        .updateTable('users')
        .set({ password: passwordHash, updated_at: new Date().toISOString() })
        .where('id', '=', userId)
        .execute()
    },

    // Derives a unique username from a Google email's local part (e.g.
    // "pat.farrell@gmail.com" -> "patfarrell"), appending a numeric suffix
    // on collision. Falls back to "user" if the local part sanitizes to
    // nothing (e.g. an email starting with only symbols/digits-as-separators).
    async createUserFromGoogle({ email }: { email: string }) {
      const localPart = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'
      const base = localPart.length >= 3 ? localPart : localPart.padEnd(3, '0')
      let username = base
      let suffix = 1
      while (await this.userExistsByUsername(username)) {
        suffix += 1
        username = `${base}${suffix}`
      }
      return db
        .insertInto('users')
        .values({
          username,
          password: null,
          email,
          admin: false,
        })
        .returningAll()
        .executeTakeFirst()
    },
  }
}

export const authService = createAuthService(db)
