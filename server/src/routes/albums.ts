import { Hono } from 'hono'
import type { Variables } from '../types.js'
import { getAlbumSummary } from '../services/wikipedia.js'
import { streamBase } from '../db/streamUrl.js'
import { albumsService } from '../services/albumsService.js'
import { countsService } from '../services/countsService.js'
import { albumNotesService } from '../services/albumNotesService.js'
import { createRecallNote, getRecallItem, decryptRecallToken, appendBacklink, stripBacklink } from '../services/recallService.js'

const albums = new Hono<{ Variables: Variables }>()

// GET /albums/random?size=N&tag=slug
albums.get('/random', async (c) => {
  const size = Math.min(parseInt(c.req.query('size') ?? '10'), 200)
  const tag = c.req.query('tag')

  const rows = tag
    ? await albumsService.randomByTag(tag, size)
    : await albumsService.randomAll(size)

  const albumIds = rows.rows.map((row: any) => row.id)
  const trackCounts = await countsService.trackCountsByAlbumIds(albumIds)

  return c.json(rows.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    image_path: row.image_path,
    artist: { id: row.artist_id, name: row.artist_name },
    has_collaborators: row.has_collaborators,
    track_count: trackCounts.get(row.id) ?? 0,
  })))
})

// GET /album/:id
albums.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  const album = await albumsService.findAlbumById(id)

  if (!album) return c.json({ error: 'Not found' }, 404)

  const artist = await albumsService.findArtistById(album.artist_id)

  if (!artist) return c.json({ error: 'Artist not found' }, 404)

  // Fetch tracks with their artist info (track-level artist override)
  const trackRows = await albumsService.findTracksByAlbumId(id)

  trackRows.sort((a, b) => (parseInt(a.track_number ?? '0') || 0) - (parseInt(b.track_number ?? '0') || 0))

  const tracks = trackRows.map((t) => ({
    id: t.id,
    title: t.title,
    track_number: t.track_number,
    duration: t.duration_sec,
    album: { id: album.id, title: album.title, artist: { id: artist.id, name: artist.name } },
    artist: { id: t.artist_id ?? artist.id, name: t.artist_name ?? artist.name },
    image_path: album.image_path,
    url: `${streamBase(c)}/stream/${t.id}`,
    download_url: `${streamBase(c)}/download/${t.id}`,
  }))

  const secondaryArtistRows = await albumsService.findSecondaryArtistsByAlbumId(id)

  const secondary_artists = secondaryArtistRows.map(r => ({ id: r.id, name: r.name, role: r.role }))

  const collections = await albumsService.findCollectionsByAlbumId(id)

  // For various-artists albums, list every distinct artist credited on a
  // track (deduplicated, first-occurrence/track order) so the frontend can
  // show them in place of a single owning artist.
  // The "Various Artists" placeholder itself (id 161, see docs/architecture.md)
  // must never appear in this list: a track with a null artist_id falls back
  // to the album's own artist above, which for a compilation IS the
  // placeholder — surfacing it here would leak the placeholder's identity
  // into a display specifically designed to decouple from it.
  const VARIOUS_ARTISTS_ID = 161
  const compilation_artists: { id: number; name: string }[] = []
  if (album.is_compilation) {
    const seen = new Set<number>()
    for (const t of tracks) {
      if (t.artist.id === VARIOUS_ARTISTS_ID) continue
      if (!seen.has(t.artist.id)) {
        seen.add(t.artist.id)
        compilation_artists.push(t.artist)
      }
    }
  }

  const summary = await getAlbumSummary(
    artist.name,
    album.title,
    artist.wikipedia,
    album.wikipedia
  )

  const noteRows = await albumNotesService.listNotesByAlbumId(id)
  const authorTokens = new Map<number, string>()
  for (const row of noteRows) {
    if (!authorTokens.has(row.author_id)) {
      const conn = await albumNotesService.getConnection(row.author_id)
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

  return c.json({ album, artist, secondary_artists, compilation_artists, tracks, collections, notes, summary: summary ?? {} })
})

// POST /album/:id/notes — requires a connected Recall account; creates a new journal-style note
albums.post('/:id/notes', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Authentication required' }, 401)

  const albumId = parseInt(c.req.param('id'))
  const connection = await albumNotesService.getConnection(user.id)
  if (!connection) return c.json({ error: 'Recall not connected' }, 403)

  const body = await c.req.json()
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return c.json({ error: 'content is required' }, 400)

  const album = await albumsService.findAlbumById(albumId)
  if (!album) return c.json({ error: 'Album not found' }, 404)
  const artist = await albumsService.findArtistById(album.artist_id)

  const token = decryptRecallToken(connection.recall_token)
  let item
  try {
    item = await createRecallNote(token, {
      title: `${album.title} — ${artist?.name ?? 'Unknown Artist'}`,
      contentText: appendBacklink(content, albumId),
      tags: ['bemused'],
    })
  } catch (err) {
    console.error('Failed to create Recall note:', err)
    return c.json({ error: 'Failed to save note to Recall' }, 502)
  }

  const note = await albumNotesService.createNote(albumId, user.id, item.id)
  return c.json({ id: note.id, recall_item_id: item.id }, 201)
})

// DELETE /album/:id/notes/:noteId — unlinks only; the Recall item itself is untouched
albums.delete('/:id/notes/:noteId', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Authentication required' }, 401)

  const noteId = parseInt(c.req.param('noteId'))
  const note = await albumNotesService.findNoteById(noteId)
  if (!note) return c.json({ error: 'Not found' }, 404)

  if (note.author_user_id !== user.id && !user.admin) {
    return c.json({ error: 'Not permitted' }, 403)
  }

  await albumNotesService.deleteNote(noteId)
  return c.json({ ok: true })
})

export default albums
