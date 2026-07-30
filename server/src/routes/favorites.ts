import { Hono } from 'hono'
import type { Context } from 'hono'
import { db } from '../db/database.js'
import { requireAuth } from '../middleware/auth.js'
import type { Variables } from '../types.js'
import { countsService } from '../services/countsService.js'
import { fetchTracksForIds } from './playlists.js'

const favorites = new Hono<{ Variables: Variables }>()
favorites.use('*', requireAuth)

const VALID_KINDS = ['artist', 'album', 'track', 'playlist', 'collection'] as const
type Kind = typeof VALID_KINDS[number]

function isKind(value: unknown): value is Kind {
  return typeof value === 'string' && (VALID_KINDS as readonly string[]).includes(value)
}

async function hydrateItems(kind: Kind, ids: number[], c: Context): Promise<Map<number, any>> {
  if (ids.length === 0) return new Map()

  if (kind === 'artist') {
    const rows = await db.selectFrom('artists').select(['id', 'name', 'image_path']).where('id', 'in', ids).execute()
    return new Map(rows.map((r) => [r.id, r]))
  }

  if (kind === 'album') {
    const rows = await db
      .selectFrom('albums')
      .leftJoin('artists', 'artists.id', 'albums.artist_id')
      .select([
        'albums.id', 'albums.title', 'albums.image_path',
        'artists.id as artist_id', 'artists.name as artist_name',
      ])
      .where('albums.id', 'in', ids)
      .execute()
    const trackCounts = await countsService.trackCountsByAlbumIds(ids)
    return new Map(rows.map((r) => [r.id, {
      id: r.id,
      title: r.title,
      image_path: r.image_path,
      track_count: trackCounts.get(r.id) ?? 0,
      artist: r.artist_id ? { id: r.artist_id, name: r.artist_name } : null,
    }]))
  }

  if (kind === 'track') {
    const tracks = await fetchTracksForIds(ids, c)
    return new Map(tracks.map((t: any) => [t.id, t]))
  }

  if (kind === 'playlist') {
    const rows = await db.selectFrom('playlists').select(['id', 'name', 'image_path']).where('id', 'in', ids).execute()
    const trackCounts = await countsService.trackCountsByPlaylistIds(ids)
    return new Map(rows.map((r) => [r.id, { ...r, track_count: trackCounts.get(r.id) ?? 0 }]))
  }

  // collection
  const rows = await db.selectFrom('collections').select(['id', 'name', 'image_path']).where('id', 'in', ids).execute()
  const albumCounts = await countsService.albumCountsByCollectionIds(ids)
  return new Map(rows.map((r) => [r.id, { ...r, album_count: albumCounts.get(r.id) ?? 0 }]))
}

async function hydrateFavorites(rows: { id: number; kind: string; target_id: number; created_at: Date }[], c: Context) {
  const idsByKind = new Map<Kind, number[]>()
  for (const row of rows) {
    if (!isKind(row.kind)) continue
    const list = idsByKind.get(row.kind) ?? []
    list.push(row.target_id)
    idsByKind.set(row.kind, list)
  }

  const itemsByKind = new Map<Kind, Map<number, any>>()
  for (const kind of idsByKind.keys()) {
    itemsByKind.set(kind, await hydrateItems(kind, idsByKind.get(kind)!, c))
  }

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    target_id: row.target_id,
    created_at: row.created_at,
    item: isKind(row.kind) ? (itemsByKind.get(row.kind)?.get(row.target_id) ?? null) : null,
  }))
}

// GET /favorites?kind=track — current user's favorites, hydrated, newest first
favorites.get('/', async (c) => {
  const user = c.get('user')!
  const kindFilter = c.req.query('kind')

  let query = db.selectFrom('favorites').selectAll().where('user_id', '=', user.id)
  if (kindFilter) query = query.where('kind', '=', kindFilter)
  const rows = await query.orderBy('created_at', 'desc').execute()

  return c.json(await hydrateFavorites(rows, c))
})

// POST /favorites { kind, target_id } — idempotent add
favorites.post('/', async (c) => {
  const user = c.get('user')!
  const { kind, target_id } = await c.req.json()

  if (!isKind(kind) || !Number.isInteger(target_id)) {
    return c.json({ error: 'Invalid kind or target_id' }, 400)
  }

  await db
    .insertInto('favorites')
    .values({ user_id: user.id, kind, target_id })
    .onConflict((oc) => oc.columns(['user_id', 'kind', 'target_id']).doNothing())
    .execute()

  const row = await db
    .selectFrom('favorites')
    .selectAll()
    .where('user_id', '=', user.id)
    .where('kind', '=', kind)
    .where('target_id', '=', target_id)
    .executeTakeFirstOrThrow()

  const [hydrated] = await hydrateFavorites([row], c)
  return c.json(hydrated)
})

// DELETE /favorites { kind, target_id }
favorites.delete('/', async (c) => {
  const user = c.get('user')!
  const { kind, target_id } = await c.req.json()

  if (!isKind(kind) || !Number.isInteger(target_id)) {
    return c.json({ error: 'Invalid kind or target_id' }, 400)
  }

  await db
    .deleteFrom('favorites')
    .where('user_id', '=', user.id)
    .where('kind', '=', kind)
    .where('target_id', '=', target_id)
    .execute()

  return c.json({ success: true })
})

export default favorites
