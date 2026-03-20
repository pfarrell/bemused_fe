import { Hono } from 'hono'
import { db } from '../db/database.js'
import { getArtistSummary } from '../services/wikipedia.js'
import { sql } from 'kysely'

const artists = new Hono()

// GET /artists/random?size=N
artists.get('/random', async (c) => {
  const size = Math.min(parseInt(c.req.query('size') ?? '10'), 200)

  // Artists that have at least one album and have an image, in random order.
  // Uses a window function to deduplicate (mirrors the Ruby query).
  const rows = await sql<any>`
    SELECT DISTINCT ON (a.id) a.*
    FROM artists a
    INNER JOIN albums al ON al.artist_id = a.id
    WHERE a.image_path IS NOT NULL
    ORDER BY a.id, random()
    LIMIT ${size}
  `.execute(db)

  // Shuffle at app level since DISTINCT ON forces ORDER BY id first
  const shuffled = rows.rows.sort(() => Math.random() - 0.5)
  return c.json(shuffled)
})

// GET /artist/:id
artists.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  const artist = await db
    .selectFrom('artists')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()

  if (!artist) return c.json({ error: 'Not found' }, 404)

  const albums = await db
    .selectFrom('albums')
    .selectAll()
    .where('artist_id', '=', id)
    .orderBy('release_year', 'asc')
    .execute()

  // Only return albums that have at least one track
  const albumsWithTracks = await db
    .selectFrom('albums')
    .innerJoin('tracks', 'tracks.album_id', 'albums.id')
    .select('albums.id')
    .where('albums.artist_id', '=', id)
    .distinct()
    .execute()

  const albumIdsWithTracks = new Set(albumsWithTracks.map((a) => a.id))
  const filteredAlbums = albums
    .filter((a) => albumIdsWithTracks.has(a.id))
    .map((a) => ({ ...a, artist: { id: artist.id, name: artist.name } }))

  const summary = await getArtistSummary(artist.name, artist.wikipedia)

  return c.json({ artist, summary: summary ?? {}, albums: filteredAlbums })
})

export default artists
