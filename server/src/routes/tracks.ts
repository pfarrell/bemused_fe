// server/src/routes/tracks.ts
import { Hono } from 'hono'
import type { Variables } from '../types.js'
import { db } from '../db/database.js'
import { notesService } from '../services/notesService.js'
import { createRecallNote, getRecallItem, decryptRecallToken, appendBacklink, stripBacklink } from '../services/recallService.js'

const tracks = new Hono<{ Variables: Variables }>()

// GET /track/:id/notes — fetched on demand only (never embedded in bulk tracklist responses:
// an album/playlist tracklist rendering many tracks must not trigger a live Recall fetch per track)
tracks.get('/:id/notes', async (c) => {
  const id = parseInt(c.req.param('id'))

  const noteRows = await notesService.listNotesByTarget('track', id)
  const authorTokens = new Map<number, string>()
  for (const row of noteRows) {
    if (!authorTokens.has(row.author_id)) {
      const conn = await notesService.getConnection(row.author_id)
      if (conn) {
        try {
          authorTokens.set(row.author_id, decryptRecallToken(conn.recall_token))
        } catch {
          // leave unset — this author's notes fall through to error: true below
        }
      }
    }
  }
  const notes = await Promise.all(noteRows.map(async (row) => {
    const base = { id: row.id, author: { id: row.author_id, username: row.author_username }, created_at: row.created_at }
    const token = authorTokens.get(row.author_id)
    if (!token) return { ...base, error: true as const }
    try {
      const item = await getRecallItem(token, row.recall_item_id)
      if (!item) return { ...base, error: true as const }
      return {
        ...base,
        recall_item_id: row.recall_item_id,
        title: item.title,
        content: stripBacklink(item.contentText ?? ''),
      }
    } catch {
      return { ...base, error: true as const }
    }
  }))

  return c.json({ notes })
})

// POST /track/:id/notes — requires a connected Recall account; creates a new journal-style note
tracks.post('/:id/notes', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Authentication required' }, 401)

  const trackId = parseInt(c.req.param('id'))
  const connection = await notesService.getConnection(user.id)
  if (!connection) return c.json({ error: 'Recall not connected' }, 403)

  const body = await c.req.json()
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return c.json({ error: 'content is required' }, 400)

  const track = await db
    .selectFrom('tracks')
    .leftJoin('albums', 'albums.id', 'tracks.album_id')
    .select(['tracks.id', 'tracks.title', 'tracks.album_id', 'albums.title as album_title'])
    .where('tracks.id', '=', trackId)
    .executeTakeFirst()
  if (!track) return c.json({ error: 'Track not found' }, 404)

  const token = decryptRecallToken(connection.recall_token)
  let item
  try {
    item = await createRecallNote(token, {
      title: track.album_title ? `${track.title} — ${track.album_title}` : track.title,
      // No dedicated track detail page exists in bemused — link back to the
      // track's home album instead.
      contentText: appendBacklink(content, track.album_id ? `/album/${track.album_id}` : '/'),
      tags: ['bemused'],
    })
  } catch (err) {
    console.error('Failed to create Recall note:', err)
    return c.json({ error: 'Failed to save note to Recall' }, 502)
  }

  const note = await notesService.createNote('track', trackId, user.id, item.id)
  return c.json({ id: note.id, recall_item_id: item.id }, 201)
})

// DELETE /track/:id/notes/:noteId — unlinks only; the Recall item itself is untouched
tracks.delete('/:id/notes/:noteId', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Authentication required' }, 401)

  const noteId = parseInt(c.req.param('noteId'))
  const note = await notesService.findNoteById(noteId)
  if (!note) return c.json({ error: 'Not found' }, 404)

  if (note.author_user_id !== user.id && !user.admin) {
    return c.json({ error: 'Not permitted' }, 403)
  }

  await notesService.deleteNote(noteId)
  return c.json({ ok: true })
})

export default tracks
