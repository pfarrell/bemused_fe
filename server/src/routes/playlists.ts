import { Hono } from 'hono'
import { db } from '../db/database.js'
import { streamBase } from '../db/streamUrl.js'
import { sql } from 'kysely'
import type { Variables } from '../types.js'

const playlists = new Hono<{ Variables: Variables }>()

function buildTrack(t: any) {
  return {
    id: t.id,
    title: t.title,
    track_number: t.track_number,
    duration: t.duration_sec,
    album: t.album_id ? { id: t.album_id, title: t.album_title, artist: { id: t.album_artist_id, name: t.album_artist_name } } : null,
    artist: { id: t.track_artist_id ?? t.album_artist_id, name: t.track_artist_name ?? t.album_artist_name },
    image_path: t.album_image_path,
    url: `${streamBase()}/stream/${t.id}`,
  }
}

async function fetchTracksForIds(trackIds: number[]) {
  if (!trackIds.length) return []
  const rows = await db
    .selectFrom('tracks')
    .leftJoin('albums', 'albums.id', 'tracks.album_id')
    .leftJoin('artists as album_artist', 'album_artist.id', 'albums.artist_id')
    .leftJoin('artists as track_artist', 'track_artist.id', 'tracks.artist_id')
    .select([
      'tracks.id', 'tracks.title', 'tracks.track_number', 'tracks.duration_sec',
      'albums.id as album_id', 'albums.title as album_title', 'albums.image_path as album_image_path',
      'album_artist.id as album_artist_id', 'album_artist.name as album_artist_name',
      'track_artist.id as track_artist_id', 'track_artist.name as track_artist_name',
    ])
    .where('tracks.id', 'in', trackIds)
    .execute()

  const byId = new Map(rows.map((r) => [r.id, r]))
  return trackIds.map((id) => byId.get(id)).filter(Boolean).map((t) => buildTrack(t))
}

// GET /playlist/:id
playlists.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const playlist = await db.selectFrom('playlists').selectAll().where('id', '=', id).executeTakeFirst()
  if (!playlist) return c.json({ error: 'Not found' }, 404)

  const ptRows = await db
    .selectFrom('playlist_tracks')
    .select(['track_id', 'order'])
    .where('playlist_id', '=', id)
    .orderBy('order', 'asc')
    .execute()

  const tracks = await fetchTracksForIds(ptRows.map((r) => r.track_id))
  return c.json({ playlist, tracks })
})

// GET /playlists
playlists.get('/', async (c) => {
  const rows = await db
    .selectFrom('playlists')
    .selectAll()
    .where('auto_generated', 'is', null)
    .execute()
  return c.json(rows)
})

// POST /playlists - Create a new playlist
playlists.post('/', async (c) => {
  const { name } = await c.req.json()

  const result = await db
    .insertInto('playlists')
    .values({
      name,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returningAll()
    .executeTakeFirst()

  return c.json(result)
})

// GET /top  — top 20 most played tracks in the last 7 days
playlists.get('/top', async (c) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const topRows = await db
    .selectFrom('logs')
    .select(['track_id', db.fn.count('id').as('count')])
    .where('created_at', '>', sevenDaysAgo)
    .where('track_id', 'is not', null)
    .groupBy('track_id')
    .orderBy('count', 'desc')
    .limit(20)
    .execute()

  const trackIds = topRows.map((r) => r.track_id as number)
  const tracks = await fetchTracksForIds(trackIds)

  return c.json({
    playlist: { name: 'Top 20', image_path: null },
    tracks,
  })
})

// GET /newborns?size=25  — most recently added tracks
playlists.get('/newborns', async (c) => {
  const size = parseInt(c.req.query('size') ?? '25')

  const recentTracks = await db
    .selectFrom('tracks')
    .select('id')
    .orderBy('id', 'desc')
    .limit(size)
    .execute()

  const tracks = await fetchTracksForIds(recentTracks.map((r) => r.id))
  return c.json({
    playlist: { name: 'New Arrivals', image_path: null },
    tracks,
  })
})

// GET /surprise  — random 20-track playlist
playlists.get('/surprise', async (c) => {
  const randomTracks = await sql<{ id: number }>`
    SELECT id FROM tracks ORDER BY random() LIMIT 20
  `.execute(db)

  const tracks = await fetchTracksForIds(randomTracks.rows.map((r) => r.id))
  return c.json({
    playlist: { name: 'Surprise!', image_path: null },
    tracks,
  })
})

// POST /playlist/:id/tracks - Add a track to playlist
playlists.post('/:id/tracks', async (c) => {
  const playlistId = parseInt(c.req.param('id'))
  const { track_id } = await c.req.json()

  // Get the max order for this playlist
  const maxOrderResult = await db
    .selectFrom('playlist_tracks')
    .select(db.fn.max('order').as('max_order'))
    .where('playlist_id', '=', playlistId)
    .executeTakeFirst()

  const nextOrder = (maxOrderResult?.max_order ?? 0) + 1

  await db
    .insertInto('playlist_tracks')
    .values({
      playlist_id: playlistId,
      track_id,
      order: nextOrder,
    })
    .execute()

  // Update the playlist's updated_at timestamp
  await db
    .updateTable('playlists')
    .set({ updated_at: new Date() })
    .where('id', '=', playlistId)
    .execute()

  return c.json({ success: true })
})

// DELETE /playlist/:playlistId/tracks/:trackId - Remove a track from playlist
playlists.delete('/:playlistId/tracks/:trackId', async (c) => {
  const playlistId = parseInt(c.req.param('playlistId'))
  const trackId = parseInt(c.req.param('trackId'))

  await db
    .deleteFrom('playlist_tracks')
    .where('playlist_id', '=', playlistId)
    .where('track_id', '=', trackId)
    .execute()

  return c.json({ success: true })
})

// PATCH /playlist/:id/tracks/reorder - Update track order
playlists.patch('/:id/tracks/reorder', async (c) => {
  const playlistId = parseInt(c.req.param('id'))
  const { track_orders } = await c.req.json() // Array of { track_id, order }

  // Update each track's order
  for (const { track_id, order } of track_orders) {
    await db
      .updateTable('playlist_tracks')
      .set({ order })
      .where('playlist_id', '=', playlistId)
      .where('track_id', '=', track_id)
      .execute()
  }

  return c.json({ success: true })
})

// PUT /playlist/:id - Update playlist metadata
playlists.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const { name, image_path } = await c.req.json()

  await db
    .updateTable('playlists')
    .set({ name, image_path })
    .where('id', '=', id)
    .execute()

  return c.json({ success: true })
})

export default playlists
