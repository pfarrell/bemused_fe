import { Hono } from 'hono'
import { db } from '../db/database.js'
import { getArtistSummary } from '../services/wikipedia.js'
import { sql } from 'kysely'

// Minimum similarity score to include in similar_artists response (0–1 scale).
// Adjust this constant to tune how many similar artists appear on artist pages.
const SIMILAR_ARTIST_MIN_SIMILARITY = 0.8

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
  const allFilteredAlbums = albums
    .filter((a) => albumIdsWithTracks.has(a.id))
    .map((a) => ({ ...a, artist: { id: artist.id, name: artist.name } }))

  const singlesAlbumIds = allFilteredAlbums.filter(a => a.title === '_Singles').map(a => a.id)
  const filteredAlbums = allFilteredAlbums.filter(a => a.title !== '_Singles')

  let singles: any[] = []
  if (singlesAlbumIds.length > 0) {
    const singlesRows = await db
      .selectFrom('tracks')
      .innerJoin('artists as ta', 'ta.id', 'tracks.artist_id')
      .innerJoin('albums', 'albums.id', 'tracks.album_id')
      .select([
        'tracks.id',
        'tracks.title',
        'tracks.duration_sec',
        'tracks.track_number',
        'ta.id as artist_id',
        'ta.name as artist_name',
        'albums.id as album_id',
        'albums.title as album_title',
      ])
      .where('tracks.album_id', 'in', singlesAlbumIds)
      .orderBy('tracks.track_number', 'asc')
      .execute()

    singles = singlesRows.map(t => ({
      id: t.id,
      title: t.title,
      duration: t.duration_sec,
      track_number: t.track_number,
      artist: { id: t.artist_id, name: t.artist_name },
      album: { id: t.album_id, title: t.album_title, artist: { id: artist.id, name: artist.name } },
    }))
  }

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

  const relationRows = await db
    .selectFrom('artist_relations')
    .innerJoin('artists as ra', 'ra.id', 'artist_relations.related_artist_id')
    .select(['ra.id', 'ra.name', 'artist_relations.kind', 'artist_relations.source'])
    .where('artist_relations.artist_id', '=', id)
    .orderBy('ra.name', 'asc')
    .execute()

  const related_artists = relationRows.filter(r => r.kind === 'related' && r.source === 'manual').map(r => ({ id: r.id, name: r.name }))
  const members = relationRows.filter(r => r.kind === 'member').map(r => ({ id: r.id, name: r.name }))

  const memberOfRows = await db
    .selectFrom('artist_relations')
    .innerJoin('artists as ga', 'ga.id', 'artist_relations.artist_id')
    .select(['ga.id', 'ga.name'])
    .where('artist_relations.related_artist_id', '=', id)
    .where('artist_relations.kind', '=', 'member')
    .orderBy('ga.name', 'asc')
    .execute()
  const member_of = memberOfRows.map(r => ({ id: r.id, name: r.name }))

  const similarRows = await db
    .selectFrom('artist_relations as ar')
    .innerJoin('artists as ra', 'ra.id', 'ar.related_artist_id')
    .select([
      'ra.id',
      'ra.name',
      'ar.similarity',
      sql<boolean>`EXISTS(
        SELECT 1 FROM tracks t
        INNER JOIN albums al ON al.id = t.album_id
        WHERE al.artist_id = ra.id
      )`.as('has_tracks'),
    ])
    .where('ar.artist_id', '=', id)
    .where('ar.kind', '=', 'similar')
    .where('ar.similarity', '>=', SIMILAR_ARTIST_MIN_SIMILARITY)
    .orderBy('ar.similarity', 'desc')
    .execute()

  const similar_artists = similarRows.map(r => ({
    id: r.id,
    name: r.name,
    similarity: r.similarity,
    has_tracks: r.has_tracks,
  }))

  const summary = await getArtistSummary(artist.name, artist.wikipedia)

  return c.json({ artist, summary: summary ?? {}, albums: filteredAlbums, singles, appears_on, related_artists, members, member_of, similar_artists })
})

export default artists
