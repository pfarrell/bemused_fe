import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import artists from './routes/artists.js'
import albums from './routes/albums.js'
import search from './routes/search.js'
import streams from './routes/streams.js'
import logs from './routes/logs.js'
import playlists from './routes/playlists.js'
import admin from './routes/admin.js'

const app = new Hono()

app.use('*', cors())

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: err.message, stack: err.stack }, 500)
})

// Health check
app.get('/health', (c) => c.json({ ok: true }))

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
app.route('/admin', admin)

const port = parseInt(process.env.PORT ?? '3000')

console.log(`Bemused API server starting on port ${port}`)

serve({ fetch: app.fetch, port })
