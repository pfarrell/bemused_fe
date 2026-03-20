import { Hono } from 'hono'
import { db } from '../db/database.js'

const logs = new Hono()

// GET /log/:id  — log a play event at the 5-second mark
logs.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  const track = await db
    .selectFrom('tracks')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()

  if (!track) return c.text('', 200)

  await db
    .insertInto('logs')
    .values({
      track_id: track.id,
      album_id: track.album_id,
      artist_id: track.artist_id,
      action: 'stream',
    })
    .execute()

  return c.text('', 200)
})

export default logs
