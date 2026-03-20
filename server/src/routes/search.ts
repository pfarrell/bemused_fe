import { Hono } from 'hono'
import { db } from '../db/database.js'
import { streamBase } from '../db/streamUrl.js'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.BEMUSED_DB })

const search = new Hono()

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with',
])

function filterQuery(q: string): string {
  return q
    .replace(/[^\w\s]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .join(' ')
}

// GET /search?q=query
search.get('/', async (c) => {
  const query = c.req.query('q') ?? ''
  if (query.length < 3) {
    return c.json({ artists: [], albums: [], tracks: [], playlists: [], count: 0 })
  }

  const filteredQ = filterQuery(query)
  if (filteredQ.length < 3) {
    return c.json({ artists: [], albums: [], tracks: [], playlists: [], count: 0 })
  }

  const likeParam = `%${query}%`

  const searchSql = `
    SELECT q.model_type, q.id, q.similarity_score FROM (
      (SELECT DISTINCT ON (a.id) 'Album' AS model_type, a.id, 0.8 AS similarity_score
        FROM albums a
        INNER JOIN tracks t ON t.album_id = a.id
        WHERE f_unaccent(lower(a.title)) ILIKE lower($1)
        ORDER BY a.id)
      UNION ALL
      (SELECT model_type, id, similarity_score FROM (
        SELECT 'Album' AS model_type, a.id,
          similarity(f_unaccent(lower(a.title)), lower($2)) AS similarity_score,
          ROW_NUMBER() OVER(PARTITION BY a.id ORDER BY similarity(f_unaccent(lower(a.title)), lower($2)) DESC) AS rn
        FROM albums a
        INNER JOIN tracks t ON t.album_id = a.id
        WHERE similarity(f_unaccent(lower(a.title)), lower($2)) > 0.24
      ) ranked WHERE rn = 1 ORDER BY similarity_score DESC)
      UNION ALL
      (SELECT 'Artist' AS model_type, a.id, 0.8 AS similarity_score
        FROM artists a
        INNER JOIN albums al ON al.artist_id = a.id
        WHERE f_unaccent(lower(a.name)) ILIKE lower($1))
      UNION ALL
      (SELECT model_type, id, similarity_score FROM (
        SELECT 'Artist' AS model_type, a.id,
          similarity(f_unaccent(lower(a.name)), lower($2)) AS similarity_score,
          ROW_NUMBER() OVER(PARTITION BY a.id ORDER BY similarity(f_unaccent(lower(a.name)), lower($2)) DESC) AS rn
        FROM artists a
        INNER JOIN albums al ON al.artist_id = a.id
        WHERE similarity(f_unaccent(lower(a.name)), lower($2)) > 0.24
      ) ranked WHERE rn = 1 ORDER BY similarity_score DESC LIMIT 50)
      UNION ALL
      (SELECT 'Playlist' AS model_type, id, -1.0 FROM playlists WHERE f_unaccent(lower(name)) ILIKE lower($1))
      UNION ALL
      (SELECT 'Track' AS model_type, id, -1.0 FROM tracks WHERE f_unaccent(lower(title)) ILIKE lower($1))
    ) q ORDER BY q.similarity_score DESC
  `

  const { rows: searchRows } = await pool.query<{ model_type: string; id: number; similarity_score: number }>(
    searchSql,
    [likeParam, filteredQ]
  )
  const results = { rows: searchRows }

  // Group ids by type, preserving order and deduplicating (keep first/highest-score occurrence)
  const grouped: Record<string, number[]> = {}
  for (const row of results.rows) {
    if (!grouped[row.model_type]) grouped[row.model_type] = []
    if (!grouped[row.model_type].includes(row.id)) {
      grouped[row.model_type].push(row.id)
    }
  }

  // Fetch full objects for each type
  async function fetchByIds(table: 'artists' | 'playlists', ids: number[]) {
    if (!ids?.length) return []
    const rows = await db.selectFrom(table).selectAll().where('id', 'in', ids).execute()
    const byId = new Map(rows.map((r: any) => [r.id, r]))
    return ids.map((id) => byId.get(id)).filter(Boolean)
  }

  async function fetchAlbumsByIds(ids: number[]) {
    if (!ids?.length) return []
    const rows = await db
      .selectFrom('albums')
      .innerJoin('artists', 'artists.id', 'albums.artist_id')
      .select([
        'albums.id', 'albums.title', 'albums.image_path', 'albums.release_year', 'albums.wikipedia',
        'artists.id as artist_id', 'artists.name as artist_name',
      ])
      .where('albums.id', 'in', ids)
      .execute()
    const byId = new Map(rows.map((r) => [r.id, { ...r, artist: { id: r.artist_id, name: r.artist_name } }]))
    return ids.map((id) => byId.get(id)).filter(Boolean)
  }

  async function fetchTracksByIds(ids: number[]) {
    if (!ids?.length) return []
    const rows = await db
      .selectFrom('tracks')
      .leftJoin('albums', 'albums.id', 'tracks.album_id')
      .leftJoin('artists as album_artist', 'album_artist.id', 'albums.artist_id')
      .leftJoin('artists as track_artist', 'track_artist.id', 'tracks.artist_id')
      .select([
        'tracks.id',
        'tracks.title',
        'tracks.track_number',
        'tracks.duration_sec',
        'albums.id as album_id',
        'albums.title as album_title',
        'albums.image_path as album_image_path',
        'album_artist.id as album_artist_id',
        'album_artist.name as album_artist_name',
        'track_artist.id as track_artist_id',
        'track_artist.name as track_artist_name',
      ])
      .where('tracks.id', 'in', ids)
      .execute()

    return rows.map((t) => ({
      id: t.id,
      title: t.title,
      track_number: t.track_number,
      duration: t.duration_sec,
      album: t.album_id ? { id: t.album_id, title: t.album_title, artist: { id: t.album_artist_id, name: t.album_artist_name } } : null,
      artist: { id: t.track_artist_id ?? t.album_artist_id, name: t.track_artist_name ?? t.album_artist_name },
      image_path: t.album_image_path,
      url: `${streamBase()}/stream/${t.id}`,
    }))
  }

  const [albums, artists, playlists, tracks] = await Promise.all([
    fetchAlbumsByIds(grouped['Album'] ?? []),
    fetchByIds('artists', grouped['Artist'] ?? []),
    fetchByIds('playlists', grouped['Playlist'] ?? []),
    fetchTracksByIds(grouped['Track'] ?? []),
  ])

  return c.json({ artists, albums, tracks, playlists, count: 0 })
})

export default search
