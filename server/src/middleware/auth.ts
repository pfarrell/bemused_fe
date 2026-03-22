import { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import jwt from 'jsonwebtoken'
import { db } from '../db/database.js'
import type { Variables } from '../types.js'

const JWT_SECRET = process.env.BEMUSED_JWT_SECRET || 'default-secret-change-me'

interface JWTPayload {
  id: number
  username: string
  admin: boolean
}

type AppContext = Context<{ Variables: Variables }>

// Middleware to extract and verify JWT from cookie
export async function authMiddleware(c: AppContext, next: Next) {
  try {
    const token = getCookie(c, 'auth')

    if (!token) {
      // No token, continue without user
      await next()
      return
    }

    // Verify and decode token
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload

    // Fetch user from database
    const user = await db
      .selectFrom('users')
      .select(['id', 'username', 'email', 'admin'])
      .where('id', '=', decoded.id)
      .executeTakeFirst()

    if (user) {
      // Set user in context for downstream handlers
      c.set('user', user)
    }

    await next()
  } catch (error) {
    // Invalid token, continue without user
    await next()
  }
}

// Middleware to require authentication
export async function requireAuth(c: AppContext, next: Next) {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  await next()
}

// Middleware to require admin privileges
export async function requireAdmin(c: AppContext, next: Next) {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  if (!user.admin) {
    return c.json({ error: 'Admin privileges required' }, 403)
  }

  await next()
}
