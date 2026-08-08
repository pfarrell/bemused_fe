import { Hono } from 'hono'
import { db } from '../db/database.js'
import type { Variables } from '../types.js'
import { notesService } from '../services/notesService.js'
import { createRecallNote, getRecallItem, decryptRecallToken, appendBacklink, stripBacklink } from '../services/recallService.js'
import { getCollectionSummary } from '../services/wikipedia.js'

const collections = new Hono<{ Variables: Variables }>()

function buildAlbum(a: any) {
  return {
    id: a.id,
    title: a.title,
    image_path: a.image_path,
    release_year: a.release_year,
    artist: { id: a.artist_id, name: a.artist_name },
  }
}

// GET /collections
collections.get('/', async (c) => {
  const rows = await db.selectFrom('collections').selectAll().orderBy('name', 'asc').execute()
  if (rows.length === 0) return c.json([])

  const collectionIds = rows.map((r) => r.id)
  const albumRows = await db
    .selectFrom('collection_albums')
    .innerJoin('albums', 'albums.id', 'collection_albums.album_id')
    .select(['collection_albums.collection_id', 'albums.id as album_id', 'albums.image_path'])
    .where('collection_albums.collection_id', 'in', collectionIds)
    .where('albums.image_path', 'is not', null)
    .orderBy('collection_albums.order', 'asc')
    .execute()

  const previewsByCollection = new Map<number, { id: number; image_path: string }[]>()
  for (const row of albumRows) {
    const list = previewsByCollection.get(row.collection_id) ?? []
    if (list.length < 4) {
      list.push({ id: row.album_id, image_path: row.image_path as string })
      previewsByCollection.set(row.collection_id, list)
    }
  }

  return c.json(rows.map((r) => ({ ...r, preview_albums: previewsByCollection.get(r.id) ?? [] })))
})

// GET /collection/:id
collections.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const collection = await db.selectFrom('collections').selectAll().where('id', '=', id).executeTakeFirst()
  if (!collection) return c.json({ error: 'Not found' }, 404)

  const summary = await getCollectionSummary(collection.wikipedia)

  const caRows = await db
    .selectFrom('collection_albums')
    .select(['album_id', 'order'])
    .where('collection_id', '=', id)
    .orderBy('order', 'asc')
    .execute()

  const albumIds = caRows.map((r) => r.album_id)
  const albums = albumIds.length
    ? (await db
        .selectFrom('albums')
        .innerJoin('artists', 'artists.id', 'albums.artist_id')
        .select([
          'albums.id', 'albums.title', 'albums.image_path', 'albums.release_year',
          'artists.id as artist_id', 'artists.name as artist_name',
        ])
        .where('albums.id', 'in', albumIds)
        .execute()).map(buildAlbum)
    : []

  // Preserve order from collection_albums
  const byId = new Map(albums.map((a) => [a.id, a]))
  const orderedAlbums = albumIds.map((id) => byId.get(id)).filter(Boolean)

  const noteRows = await notesService.listNotesByTarget('collection', id)
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

  return c.json({ collection, albums: orderedAlbums, notes, summary: summary ?? {} })
})

// POST /collections
collections.post('/', async (c) => {
  const { name } = await c.req.json()
  if (!name?.trim()) return c.json({ error: 'Name is required' }, 400)

  const result = await db
    .insertInto('collections')
    .values({ name: name.trim(), created_at: new Date(), updated_at: new Date() })
    .returningAll()
    .executeTakeFirst()

  return c.json(result, 201)
})

// PUT /collection/:id
collections.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const { name, image_path, wikipedia } = await c.req.json()

  await db.updateTable('collections').set({ name, image_path, wikipedia }).where('id', '=', id).execute()
  return c.json({ success: true })
})

// POST /collection/:id/albums
collections.post('/:id/albums', async (c) => {
  const collectionId = parseInt(c.req.param('id'))
  const { album_id } = await c.req.json()

  const maxOrderResult = await db
    .selectFrom('collection_albums')
    .select(db.fn.max('order').as('max_order'))
    .where('collection_id', '=', collectionId)
    .executeTakeFirst()

  const nextOrder = (maxOrderResult?.max_order ?? 0) + 1

  await db
    .insertInto('collection_albums')
    .values({ collection_id: collectionId, album_id, order: nextOrder })
    .onConflict((oc) => oc.columns(['collection_id', 'album_id']).doNothing())
    .execute()

  await db.updateTable('collections').set({ updated_at: new Date() }).where('id', '=', collectionId).execute()
  return c.json({ success: true })
})

// POST /collection/:id/stubs — add a placeholder for an album not yet owned
collections.post('/:id/stubs', async (c) => {
  const collectionId = parseInt(c.req.param('id'))
  const { title, artist_name } = await c.req.json()
  const user = c.get('user')

  if (!title || !title.trim()) {
    return c.json({ error: 'Title is required' }, 400)
  }

  const [maxAlbumOrder, maxStubOrder] = await Promise.all([
    db.selectFrom('collection_albums').select(db.fn.max('order').as('max_order')).where('collection_id', '=', collectionId).executeTakeFirst(),
    db.selectFrom('album_stubs').select(db.fn.max('order').as('max_order')).where('collection_id', '=', collectionId).executeTakeFirst(),
  ])
  const nextOrder = Math.max(maxAlbumOrder?.max_order ?? 0, maxStubOrder?.max_order ?? 0) + 1

  const stub = await db
    .insertInto('album_stubs')
    .values({
      title: title.trim(),
      artist_name: artist_name?.trim() || null,
      user_id: user?.id ?? null,
      collection_id: collectionId,
      order: nextOrder,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  await db.updateTable('collections').set({ updated_at: new Date() }).where('id', '=', collectionId).execute()
  return c.json({ stub })
})

// DELETE /collection/:id/albums/:albumId
collections.delete('/:id/albums/:albumId', async (c) => {
  const collectionId = parseInt(c.req.param('id'))
  const albumId = parseInt(c.req.param('albumId'))

  await db
    .deleteFrom('collection_albums')
    .where('collection_id', '=', collectionId)
    .where('album_id', '=', albumId)
    .execute()

  return c.json({ success: true })
})

// POST /collection/:id/notes — requires a connected Recall account; creates a new journal-style note
collections.post('/:id/notes', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Authentication required' }, 401)

  const collectionId = parseInt(c.req.param('id'))
  const connection = await notesService.getConnection(user.id)
  if (!connection) return c.json({ error: 'Recall not connected' }, 403)

  const body = await c.req.json()
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return c.json({ error: 'content is required' }, 400)

  const collection = await db.selectFrom('collections').selectAll().where('id', '=', collectionId).executeTakeFirst()
  if (!collection) return c.json({ error: 'Collection not found' }, 404)

  const token = decryptRecallToken(connection.recall_token)
  let item
  try {
    item = await createRecallNote(token, {
      title: `${collection.name} (collection)`,
      contentText: appendBacklink(content, `/collection/${collectionId}`),
      tags: ['bemused'],
    })
  } catch (err) {
    console.error('Failed to create Recall note:', err)
    return c.json({ error: 'Failed to save note to Recall' }, 502)
  }

  const note = await notesService.createNote('collection', collectionId, user.id, item.id)
  return c.json({ id: note.id, recall_item_id: item.id }, 201)
})

// DELETE /collection/:id/notes/:noteId — unlinks only; the Recall item itself is untouched
collections.delete('/:id/notes/:noteId', async (c) => {
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

// PATCH /collection/:id/albums/reorder
collections.patch('/:id/albums/reorder', async (c) => {
  const collectionId = parseInt(c.req.param('id'))
  const { album_orders } = await c.req.json() // [{ album_id, order }]

  for (const { album_id, order } of album_orders) {
    await db
      .updateTable('collection_albums')
      .set({ order })
      .where('collection_id', '=', collectionId)
      .where('album_id', '=', album_id)
      .execute()
  }

  return c.json({ success: true })
})

export default collections
