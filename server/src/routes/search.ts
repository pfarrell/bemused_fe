import { Hono } from 'hono'
import { searchService } from '../services/searchService.js'

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

const QUOTE_CHARS = new Set(['"', '“', '”'])

// Whole-query quoting only: "query" (or curly-quote variants, since iOS can
// auto-convert straight quotes) switches from fuzzy similarity matching to
// exact substring matching for the entire request.
export function parseQuoted(rawQuery: string): { query: string; exactOnly: boolean } {
  const trimmed = rawQuery.trim()
  if (
    trimmed.length >= 2 &&
    QUOTE_CHARS.has(trimmed[0]) &&
    QUOTE_CHARS.has(trimmed[trimmed.length - 1])
  ) {
    return { query: trimmed.slice(1, -1).trim(), exactOnly: true }
  }
  return { query: trimmed, exactOnly: false }
}

const TYPE_KEY_MAP: Record<string, 'album' | 'artist' | 'playlist' | 'collection'> = {
  Album: 'album',
  Artist: 'artist',
  Playlist: 'playlist',
  Collection: 'collection',
}

async function buildRankedResults(likeParam: string, filteredQ: string, exactOnly: boolean) {
  const searchRows = await searchService.runUnionSearch(likeParam, filteredQ, exactOnly)

  // Dedup by (type, id), keeping the first occurrence — since searchRows is already
  // ordered by score DESC and an exact-branch row (score 2.0) always sorts before a
  // fuzzy-branch row for the same entity, this keeps the exact-match row.
  const orderedRefs: { type: string; id: number }[] = []
  const seen = new Set<string>()
  for (const row of searchRows) {
    const key = `${row.model_type}:${row.id}`
    if (!seen.has(key)) {
      seen.add(key)
      orderedRefs.push({ type: row.model_type, id: row.id })
    }
  }

  const albumIds = orderedRefs.filter((r) => r.type === 'Album').map((r) => r.id)
  const artistIds = orderedRefs.filter((r) => r.type === 'Artist').map((r) => r.id)
  const playlistIds = orderedRefs.filter((r) => r.type === 'Playlist').map((r) => r.id)
  const collectionIds = orderedRefs.filter((r) => r.type === 'Collection').map((r) => r.id)

  const [albums, artists, playlists, collections] = await Promise.all([
    searchService.fetchAlbumsByIds(albumIds),
    searchService.fetchArtistsWithCounts(artistIds),
    searchService.fetchPlaylistsWithCounts(playlistIds),
    searchService.fetchCollectionsByIds(collectionIds),
  ])

  const byType: Record<string, Map<number, any>> = {
    Album: new Map(albums.map((a: any) => [a.id, a])),
    Artist: new Map(artists.map((a: any) => [a.id, a])),
    Playlist: new Map(playlists.map((p: any) => [p.id, p])),
    Collection: new Map(collections.map((c: any) => [c.id, c])),
  }

  return orderedRefs
    .map((ref) => {
      const data = byType[ref.type].get(ref.id)
      return data ? { type: TYPE_KEY_MAP[ref.type], data } : null
    })
    .filter((r): r is { type: 'album' | 'artist' | 'playlist' | 'collection'; data: any } => r !== null)
}

// GET /search?q=query
search.get('/', async (c) => {
  const rawQuery = c.req.query('q') ?? ''
  const { query, exactOnly } = parseQuoted(rawQuery)

  if (exactOnly ? query.length < 1 : query.length < 3) {
    return c.json({ results: [], tracks: [], count: 0 })
  }

  const filteredQ = exactOnly ? '' : filterQuery(query)
  if (!exactOnly && filteredQ.length < 3) {
    return c.json({ results: [], tracks: [], count: 0 })
  }

  const likeParam = `%${query}%`

  const [results, trackIds] = await Promise.all([
    buildRankedResults(likeParam, filteredQ, exactOnly),
    searchService.findTrackIds(likeParam),
  ])

  const tracks = await searchService.fetchTracksByIds(trackIds, c)

  return c.json({ results, tracks, count: results.length + tracks.length })
})

export default search
