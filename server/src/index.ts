import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Variables } from './types.js'
import artists from './routes/artists.js'
import albums from './routes/albums.js'
import search from './routes/search.js'
import streams from './routes/streams.js'
import logs from './routes/logs.js'
import playlists from './routes/playlists.js'
import admin from './routes/admin.js'
import upload from './routes/upload.js'
import auth from './routes/auth.js'
import { authMiddleware, requireAdmin } from './middleware/auth.js'

const app = new Hono<{ Variables: Variables }>()

app.use('*', cors({
  origin: (origin) => {
    // Allow all origins in development, specific origins in production
    if (process.env.NODE_ENV === 'production') {
      const allowedOrigins = [
        'https://patf.net',
        'https://www.patf.net',
        'https://patf.com',
        'https://www.patf.com',
        'http://172.16.1.10',
        'http://172.16.1.10:5173'
      ]
      return allowedOrigins.includes(origin || '') ? origin : allowedOrigins[0]
    }
    return origin || '*'
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 600,
  credentials: true,
}))

// Apply auth middleware globally to extract user from cookies
app.use('*', authMiddleware)

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: err.message, stack: err.stack }, 500)
})

// Health check
app.get('/health', (c) => c.json({ ok: true }))

// Auth routes (public)
app.route('/auth', auth)

// Public routes
app.route('/artists', artists)
app.route('/artist', artists)   // singular alias used by frontend (/artist/:id)
app.route('/albums', albums)
app.route('/album', albums)     // singular alias
app.route('/search', search)
app.route('/stream', streams)
app.route('/log', logs)
app.route('/playlist', playlists)
app.route('/playlists', playlists)
app.route('/top', playlists)
app.route('/newborns', playlists)
app.route('/surprise', playlists)

// Admin routes (protected)
const adminApp = new Hono()
adminApp.use('*', requireAdmin)
adminApp.route('/', admin)
adminApp.route('/upload', upload)
app.route('/admin', adminApp)

const port = parseInt(process.env.PORT ?? '3000')

console.log(`Bemused API server starting on port ${port}`)

serve({ fetch: app.fetch, port })
