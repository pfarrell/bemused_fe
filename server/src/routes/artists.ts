import { Hono } from 'hono'
import { db } from '../db/database.js'
import { getArtistSummary } from '../services/wikipedia.js'
import { sql } from 'kysely'

const artists = new Hono()

// GET /artists/random?size=N
artists.get('/random', async (c) => {
  const size = Math.min(parseInt(c.req.query('size') ?? '10'), 200)

  // Optimized random selection for large datasets (tens of thousands of artists)
  // First get all eligible IDs, then select random subset
  // This is faster than sorting full artist records
  const rows = await sql<any>`
    WITH eligible_artist_ids AS (
      SELECT DISTINCT a.id
      FROM artists a
      INNER JOIN albums al ON al.artist_id = a.id
      WHERE a.image_path IS NOT NULL
    ),
    random_ids AS (
      SELECT id
      FROM eligible_artist_ids
      ORDER BY random()
      LIMIT ${size}
    )
    SELECT a.*
    FROM artists a
    INNER JOIN random_ids r ON a.id = r.id
  `.execute(db)

  return c.json(rows.rows)
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

  const appearsOnRows = await db
    .selectFrom('artist_albums')
    .innerJoin('albums', 'albums.id', 'artist_albums.album_id')
    .innerJoin('artists as al_artist', 'al_artist.id', 'albums.artist_id')
    .select([
      'albums.id',
      'albums.title',
      'albums.release_year',
      'albums.image_path',
      'al_artist.id as primary_artist_id',
      'al_artist.name as primary_artist_name',
    ])
    .where('artist_albums.artist_id', '=', id)
    .where('artist_albums.role', '!=', 'primary')
    .orderBy('albums.release_year', 'asc')
    .execute()

  const appears_on = appearsOnRows.map(a => ({
    id: a.id,
    title: a.title,
    release_year: a.release_year,
    image_path: a.image_path,
    artist: { id: a.primary_artist_id, name: a.primary_artist_name },
  }))

  const summary = await getArtistSummary(artist.name, artist.wikipedia)

  return c.json({ artist, summary: summary ?? {}, albums: filteredAlbums, appears_on })
})

export default artists
