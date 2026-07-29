import { Hono } from 'hono'
import type { Context } from 'hono'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import type { Variables } from '../types.js'
import { authService } from '../services/authService.js'
import { isLanHost } from '../db/streamUrl.js'
import { recallAuthUrl, signRecallState, verifyRecallState, encryptRecallToken } from '../services/recallService.js'
import { notesService } from '../services/notesService.js'
import {
  createAuthorization,
  exchangeCode,
  fetchGoogleProfile,
  decideOAuthAction,
  getIdentity,
  createIdentity,
} from '../services/googleOAuthService.js'

const auth = new Hono<{ Variables: Variables }>()

const JWT_SECRET = process.env.BEMUSED_JWT_SECRET || 'default-secret-change-me'
const JWT_EXPIRES_IN = '14d'
const SALT_ROUNDS = 10

// Helper to generate JWT token
function generateToken(userId: number, username: string, admin: boolean): string {
  return jwt.sign(
    { id: userId, username, admin },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

// Cookie scoping differs by which host the request came in on (nginx passes the
// real Host through unchanged). The LAN IP gets a host-only, non-Secure cookie
// since it's plain HTTP; patf.com keeps the existing Secure, domain-scoped cookie.
// The two are independent sessions by design — see
// docs/superpowers/specs/2026-07-03-lan-access-design.md.
function cookieOptionsForRequest(c: Context): { secure: boolean; domain: string | undefined } {
  if (process.env.NODE_ENV !== 'production') {
    return { secure: false, domain: undefined }
  }
  const isLan = isLanHost(c)
  return {
    secure: !isLan,
    domain: isLan ? undefined : '.patf.com',
  }
}

// Path must be '/', not a sub-path like '/auth/google': both nginx
// (`rewrite ^/bemused/api/(.*) /$1 break`) and the Vite dev proxy strip the
// /api prefix before the request reaches this Hono app, so the backend
// never sees the same path the *browser* used to set the cookie. A
// Path=/auth/google cookie set in response to a browser request for
// /bemused/api/auth/google/start would never be sent back on
// /bemused/api/auth/google/callback, since that's the path the browser
// compares against, not whatever path Hono thinks it's routing internally.
// The existing `auth` cookie already sidesteps this the same way (path: '/').
const GOOGLE_OAUTH_COOKIE_PATH = '/'

function clearGoogleOAuthCookies(c: Context, domain: string | undefined) {
  for (const name of ['google_oauth_state', 'google_oauth_verifier', 'google_oauth_from']) {
    deleteCookie(c, name, { path: GOOGLE_OAUTH_COOKIE_PATH, domain })
  }
}

// GET /auth/google/start — kick off the PKCE flow, redirect to Google
auth.get('/google/start', async (c) => {
  const { url, state, codeVerifier } = createAuthorization()

  const returnToRaw = c.req.query('return_to')
  const returnTo = returnToRaw && returnToRaw.startsWith('/') && !returnToRaw.startsWith('//') ? returnToRaw : null

  const cookieOpts = {
    httpOnly: true,
    sameSite: 'Lax' as const,
    maxAge: 600, // 10 minutes
    path: GOOGLE_OAUTH_COOKIE_PATH,
    ...cookieOptionsForRequest(c),
  }
  setCookie(c, 'google_oauth_state', state, cookieOpts)
  setCookie(c, 'google_oauth_verifier', codeVerifier, cookieOpts)
  if (returnTo) setCookie(c, 'google_oauth_from', returnTo, cookieOpts)

  return c.redirect(url)
})

// GET /auth/google/callback — validate the code, apply the login/signup/link decision
auth.get('/google/callback', async (c) => {
  const { domain } = cookieOptionsForRequest(c)
  const spaBase = process.env.NODE_ENV === 'production' ? 'https://patf.com/bemused/app' : 'http://localhost:5173'

  const code = c.req.query('code')
  const state = c.req.query('state')
  const storedState = getCookie(c, 'google_oauth_state')
  const codeVerifier = getCookie(c, 'google_oauth_verifier')
  const returnTo = getCookie(c, 'google_oauth_from') || null

  if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
    clearGoogleOAuthCookies(c, domain)
    return c.redirect(`${spaBase}/login?error=google_failed`)
  }

  let profile
  try {
    const accessToken = await exchangeCode(code, codeVerifier)
    profile = await fetchGoogleProfile(accessToken)
  } catch (error) {
    console.error('Google OAuth exchange failed:', error)
    clearGoogleOAuthCookies(c, domain)
    return c.redirect(`${spaBase}/login?error=google_failed`)
  }

  if (!profile.email_verified) {
    clearGoogleOAuthCookies(c, domain)
    return c.redirect(`${spaBase}/login?error=google_email_unverified`)
  }

  const currentUser = c.get('user')
  const identity = await getIdentity('google', profile.sub)
  const decision = decideOAuthAction(currentUser?.id ?? null, identity?.user_id ?? null)

  let redirectPath = returnTo || '/'
  let loggedInUser: { id: number; username: string; admin: boolean } | undefined

  switch (decision.kind) {
    case 'login': {
      const found = await authService.findUserById(decision.userId)
      if (!found) {
        clearGoogleOAuthCookies(c, domain)
        return c.redirect(`${spaBase}/login?error=google_failed`)
      }
      loggedInUser = found
      break
    }
    case 'signup': {
      const created = await authService.createUserFromGoogle({ email: profile.email })
      if (!created) {
        clearGoogleOAuthCookies(c, domain)
        return c.redirect(`${spaBase}/login?error=google_failed`)
      }
      await createIdentity({ provider: 'google', providerUserId: profile.sub, userId: created.id, email: profile.email })
      loggedInUser = created
      break
    }
    case 'link': {
      await createIdentity({ provider: 'google', providerUserId: profile.sub, userId: decision.userId, email: profile.email })
      redirectPath = '/account?linked=google'
      break
    }
    case 'link-noop':
      redirectPath = '/account'
      break
    case 'link-conflict':
      clearGoogleOAuthCookies(c, domain)
      return c.redirect(`${spaBase}/account?error=google_already_linked`)
  }

  if (loggedInUser) {
    const token = generateToken(loggedInUser.id, loggedInUser.username, loggedInUser.admin)
    setCookie(c, 'auth', token, {
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: 86400 * 14,
      path: '/',
      ...cookieOptionsForRequest(c),
    })
  }

  clearGoogleOAuthCookies(c, domain)
  return c.redirect(`${spaBase}${redirectPath}`)
})

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
    const existingUser = await authService.userExistsByUsername(username)

    if (existingUser) {
      return c.json({ error: 'Username already taken' }, 409)
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    // Create user (store username as entered)
    const user = await authService.createUser({
      username,
      password: passwordHash,
      email: email || null,
    })

    if (!user) {
      return c.json({ error: 'Failed to create user' }, 500)
    }

    // Generate JWT token
    const token = generateToken(user.id, user.username, user.admin)

    // Set httpOnly cookie
    // Path must be '/' so cookie is sent to both /bemused/api and /bemused/app
    setCookie(c, 'auth', token, {
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: 86400 * 14, // 2 weeks
      path: '/',
      ...cookieOptionsForRequest(c),
    })

    // Return user data (without password)
    const recallConnection = await notesService.getConnection(user.id)
    return c.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        admin: user.admin,
        default_tag: user.default_tag ?? null,
        recall_connected: Boolean(recallConnection),
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
    const user = await authService.findUserForLogin(username)

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
      sameSite: 'Lax',
      maxAge: 86400 * 14, // 2 weeks
      path: '/',
      ...cookieOptionsForRequest(c),
    })

    // Return user data (without password)
    const recallConnection = await notesService.getConnection(user.id)
    return c.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        admin: user.admin,
        default_tag: user.default_tag ?? null,
        recall_connected: Boolean(recallConnection),
      },
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return c.json({ error: 'Authentication failed' }, 500)
  }
})

// POST /auth/logout - Clear auth cookie
auth.post('/logout', async (c) => {
  // Must match the domain the cookie was set with, or the browser won't clear it.
  const { domain } = cookieOptionsForRequest(c)
  deleteCookie(c, 'auth', {
    path: '/',
    domain,
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

    const recallConnection = await notesService.getConnection(user.id)
    return c.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        admin: user.admin,
        default_tag: user.default_tag ?? null,
        recall_connected: Boolean(recallConnection),
      },
    })
  } catch (error: any) {
    console.error('Get user error:', error)
    return c.json({ error: 'Failed to get user info' }, 500)
  }
})

// PUT /auth/default-tag — save a default tag for the current user
auth.put('/default-tag', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Authentication required' }, 401)

  const body = await c.req.json()
  const raw = body.tag ?? null
  const tag = raw
    ? raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || null
    : null

  await authService.updateDefaultTag(user.id, tag)

  return c.json({ default_tag: tag })
})

// GET /auth/recall/connect — redirect to Recall's authorize page
auth.get('/recall/connect', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Authentication required' }, 401)

  const callbackUrl = process.env.RECALL_CALLBACK_URL
  if (!callbackUrl) return c.json({ error: 'RECALL_CALLBACK_URL not configured' }, 500)

  const returnToRaw = c.req.query('return_to') ?? '/library'
  const returnTo = returnToRaw.startsWith('/') && !returnToRaw.startsWith('//') ? returnToRaw : '/library'

  const state = signRecallState(user.id, returnTo)
  return c.redirect(recallAuthUrl(callbackUrl, state))
})

// GET /auth/recall/callback — completes the Recall handshake, stores the encrypted token
auth.get('/recall/callback', async (c) => {
  const user = c.get('user')
  if (!user) {
    const loginBase = process.env.NODE_ENV === 'production' ? 'https://patf.com/bemused/app' : 'http://localhost:5173'
    return c.redirect(`${loginBase}/login`)
  }

  const token = c.req.query('token')
  const state = c.req.query('state')
  if (!token || !state) return c.json({ error: 'Missing token or state' }, 400)

  let parsed: { userId: number; returnTo: string }
  try {
    parsed = verifyRecallState(state)
  } catch {
    return c.json({ error: 'Invalid or expired state' }, 400)
  }

  if (parsed.userId !== user.id) {
    return c.json({ error: 'State does not match current session' }, 400)
  }

  await notesService.saveConnection(user.id, encryptRecallToken(token))

  const redirectBase = process.env.NODE_ENV === 'production' ? 'https://patf.com/bemused/app' : 'http://localhost:5173'
  return c.redirect(`${redirectBase}${parsed.returnTo}`)
})

// DELETE /auth/recall/connect — disconnect locally; does not revoke the token on Recall's side
auth.delete('/recall/connect', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Authentication required' }, 401)

  await notesService.deleteConnection(user.id)
  return c.json({ ok: true })
})

export default auth
