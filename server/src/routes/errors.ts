import { Hono } from 'hono'
import { db } from '../db/database.js'
import { errorLogService } from '../services/errorLogService.js'

const errors = new Hono()

// GET /admin/errors?page=1&limit=25&source=upload
errors.get('/', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1')
  const limit = parseInt(c.req.query('limit') ?? '25')
  const source = c.req.query('source') || undefined
  const offset = (page - 1) * limit

  const countResult = await errorLogService.countAll(source)
  const total = Number(countResult?.count ?? 0)
  const entries = await errorLogService.listPage(limit, offset, source)

  return c.json({
    errors: entries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
})

// DELETE /admin/errors - clear every error_log row.
// Registered before /:id so this path can never be misrouted there.
errors.delete('/', async (c) => {
  const result = await db.deleteFrom('error_log').executeTakeFirst()
  return c.json({ success: true, deleted: Number(result.numDeletedRows) })
})

// DELETE /admin/errors/:id - dismiss a single error_log row.
errors.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const deleted = await db
    .deleteFrom('error_log')
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()

  if (!deleted) return c.json({ error: 'Error not found' }, 404)
  return c.json({ success: true })
})

export default errors
