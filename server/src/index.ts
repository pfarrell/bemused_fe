import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Variables } from './types.js'
import artists from './routes/artists.js'
import albums from './routes/albums.js'
import tracks from './routes/tracks.js'
import search from './routes/search.js'
import streams, { downloads } from './routes/streams.js'
import logs from './routes/logs.js'
import playlists from './routes/playlists.js'
import collections from './routes/collections.js'
import favorites from './routes/favorites.js'
import tags from './routes/tags.js'
import share from './routes/share.js'
import admin from './routes/admin.js'
import upload from './routes/upload.js'
import auth from './routes/auth.js'
import { errorLogService } from './services/errorLogService.js'
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

app.onError(async (err, c) => {
  console.error(err)
  await errorLogService.record({
    source: 'http',
    message: err.message,
    context: `${c.req.method} ${c.req.path}`,
  })
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
app.route('/track', tracks)
app.route('/search', search)
app.route('/stream', streams)
app.route('/download', downloads)
app.route('/log', logs)
app.route('/playlist', playlists)
app.route('/playlists', playlists)
app.route('/collection', collections)
app.route('/collections', collections)
app.route('/favorites', favorites)
app.route('/tags', tags)
app.route('/share', share)
app.route('/top', playlists)
app.route('/newborns', playlists)
app.route('/surprise', playlists)

// Playlist/collection owners (not just site admins) can reach some routes under
// the /admin/playlist and /admin/collection URL space (e.g. POST .../:id/image,
// which AdminPlaylist.jsx/AdminCollection.jsx call to download a cover image).
// These routers do their own requireAuth + canModify(owner-or-admin) checks per
// route, so they're mounted here rather than under adminApp's blanket requireAdmin.
app.route('/admin/playlist', playlists)
app.route('/admin/collection', collections)

// Admin routes (protected)
const adminApp = new Hono()
adminApp.use('*', requireAdmin)
adminApp.route('/', admin)
adminApp.route('/upload', upload)
app.route('/admin', adminApp)

const port = parseInt(process.env.PORT ?? '3939')

console.log(`Bemused API server starting on port ${port}`)

serve({ fetch: app.fetch, port })
