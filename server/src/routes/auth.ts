import { Hono } from 'hono'
import { db } from '../db/database.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { setCookie, deleteCookie } from 'hono/cookie'
import type { Variables } from '../types.js'

const auth = new Hono<{ Variables: Variables }>()

const JWT_SECRET = process.env.BEMUSED_JWT_SECRET || 'default-secret-change-me'
const JWT_EXPIRES_IN = '24h'
const SALT_ROUNDS = 10

// Helper to generate JWT token
function generateToken(userId: number, username: string, admin: boolean): string {
  return jwt.sign(
    { id: userId, username, admin },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

// POST /auth/signup - Create new user account
auth.post('/signup', async (c) => {
  try {
    const body = await c.req.json()
    const { username, password, email } = body

    // Validation
    if (!username || !password) {
      return c.json({ error: 'Username and password are required' }, 400)
    }

    if (username.length < 3) {
      return c.json({ error: 'Username must be at least 3 characters' }, 400)
    }

    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400)
    }

    // Check if username already exists (case-insensitive)
    const existingUser = await db
      .selectFrom('users')
      .select('id')
      .where(db.fn('LOWER', ['username']), '=', username.toLowerCase())
      .executeTakeFirst()

    if (existingUser) {
      return c.json({ error: 'Username already taken' }, 409)
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    // Create user (store username as entered)
    const user = await db
      .insertInto('users')
      .values({
        username,
        password: passwordHash,
        email: email || null,
        admin: false, // New users are not admin by default
      })
      .returningAll()
      .executeTakeFirst()

    if (!user) {
      return c.json({ error: 'Failed to create user' }, 500)
    }

    // Generate JWT token
    const token = generateToken(user.id, user.username, user.admin)

    // Set httpOnly cookie
    // Path must be '/' so cookie is sent to both /bemused/api and /bemused/app
    setCookie(c, 'auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 86400, // 24 hours
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.patf.com' : undefined,
    })

    // Return user data (without password)
    return c.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        admin: user.admin,
      },
    })
  } catch (error: any) {
    console.error('Signup error:', error)
    return c.json({ error: 'Failed to create account' }, 500)
  }
})

// POST /auth/login - Authenticate user
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json()
    const { username, password } = body

    // Validation
    if (!username || !password) {
      return c.json({ error: 'Username and password are required' }, 400)
    }

    // Find user (case-insensitive username)
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where(db.fn('LOWER', ['username']), '=', username.toLowerCase())
      .executeTakeFirst()

    if (!user) {
      return c.json({ error: 'Invalid username or password' }, 401)
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password)

    if (!passwordMatch) {
      return c.json({ error: 'Invalid username or password' }, 401)
    }

    // Generate JWT token
    const token = generateToken(user.id, user.username, user.admin)

    // Set httpOnly cookie
    // Path must be '/' so cookie is sent to both /bemused/api and /bemused/app
    setCookie(c, 'auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 86400, // 24 hours
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.patf.com' : undefined,
    })

    // Return user data (without password)
    return c.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        admin: user.admin,
      },
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return c.json({ error: 'Authentication failed' }, 500)
  }
})

// POST /auth/logout - Clear auth cookie
auth.post('/logout', async (c) => {
  deleteCookie(c, 'auth', {
    path: '/',
  })

  return c.json({ message: 'Logged out successfully' })
})

// GET /auth/me - Get current user info
auth.get('/me', async (c) => {
  try {
    // Get user from context (set by auth middleware)
    const user = c.get('user')

    if (!user) {
      return c.json({ error: 'Not authenticated' }, 401)
    }

    return c.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        admin: user.admin,
      },
    })
  } catch (error: any) {
    console.error('Get user error:', error)
    return c.json({ error: 'Failed to get user info' }, 500)
  }
})

export default auth
