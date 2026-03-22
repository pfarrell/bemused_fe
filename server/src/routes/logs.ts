import { Hono } from 'hono'
import { db } from '../db/database.js'
import { requireAdmin } from '../middleware/auth.js'
import { sql } from 'kysely'
import type { Variables } from '../types.js'

const logs = new Hono<{ Variables: Variables }>()

// GET /log/admin?page=1&limit=25 — admin view of logs with pagination
// IMPORTANT: This must come before /:id route to avoid matching "admin" as an ID
logs.get('/admin', requireAdmin, async (c) => {
  const page = parseInt(c.req.query('page') ?? '1')
  const limit = parseInt(c.req.query('limit') ?? '25')
  const offset = (page - 1) * limit

  // Get total count
  const countResult = await db
    .selectFrom('logs')
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst()

  const total = Number(countResult?.count ?? 0)

  // Get paginated logs with track, album, and artist info
  const logEntries = await db
    .selectFrom('logs')
    .leftJoin('tracks', 'tracks.id', 'logs.track_id')
    .leftJoin('albums', 'albums.id', 'logs.album_id')
    .leftJoin('artists', 'artists.id', 'logs.artist_id')
    .selectAll('logs')
    .select('tracks.id as track_id')
    .select('tracks.title as track_title')
    .select('albums.id as album_id')
    .select('albums.title as album_title')
    .select('artists.id as artist_id')
    .select('artists.name as artist_name')
    .orderBy('logs.id', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  return c.json({
    logs: logEntries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
})

// GET /log/:id  — log a play event at the 5-second mark
logs.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  const track = await db
    .selectFrom('tracks')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()

  if (!track) return c.text('', 200)

  // Get IP address from request, checking for proxy headers
  const ip_address =
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    c.req.header('x-real-ip') ||
    c.req.header('cf-connecting-ip') ||
    null

  await db
    .insertInto('logs')
    .values({
      track_id: track.id,
      album_id: track.album_id,
      artist_id: track.artist_id,
      action: 'stream',
      created_at: new Date(),
      ip_address,
    })
    .execute()

  return c.text('', 200)
})

export default logs
