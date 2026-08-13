import { Hono } from 'hono'
import { logService } from '../services/logService.js'
import { requireAdmin } from '../middleware/auth.js'
import { extractIpAddress } from '../utils/requestIp.js'
import type { Variables } from '../types.js'

const logs = new Hono<{ Variables: Variables }>()

// GET /log/admin?page=1&limit=25 — admin view of logs with pagination
// IMPORTANT: This must come before /:id route to avoid matching "admin" as an ID
logs.get('/admin', requireAdmin, async (c) => {
  const page = parseInt(c.req.query('page') ?? '1')
  const limit = parseInt(c.req.query('limit') ?? '25')
  const offset = (page - 1) * limit

  // Get total count
  const countResult = await logService.countAll()

  const total = Number(countResult?.count ?? 0)

  // Get paginated logs with track, album, and artist info
  const logEntries = await logService.listPage(limit, offset)

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

  const track = await logService.findTrackById(id)

  if (!track) return c.text('', 200)

  // Get IP address from request, checking for proxy headers
  const ip_address = extractIpAddress(c)

  await logService.record({
    track_id: track.id,
    album_id: track.album_id,
    artist_id: track.artist_id,
    action: 'stream',
    created_at: new Date(),
    ip_address,
  })

  return c.text('', 200)
})

export default logs
