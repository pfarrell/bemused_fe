import { Hono } from 'hono'
import { db } from '../db/database.js'
import { getAlbumSummary } from '../services/wikipedia.js'
import { streamBase } from '../db/streamUrl.js'

const albums = new Hono()

// GET /album/:id
albums.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  const album = await db
    .selectFrom('albums')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()

  if (!album) return c.json({ error: 'Not found' }, 404)

  const artist = await db
    .selectFrom('artists')
    .selectAll()
    .where('id', '=', album.artist_id)
    .executeTakeFirst()

  if (!artist) return c.json({ error: 'Artist not found' }, 404)

  // Fetch tracks with their artist info (track-level artist override)
  const trackRows = await db
    .selectFrom('tracks')
    .leftJoin('artists as track_artist', 'track_artist.id', 'tracks.artist_id')
    .select([
      'tracks.id',
      'tracks.title',
      'tracks.track_number',
      'tracks.duration_sec',
      'tracks.album_id',
      'tracks.artist_id',
      'track_artist.name as artist_name',
      'track_artist.image_path as artist_image_path',
    ])
    .where('tracks.album_id', '=', id)
    .execute()

  trackRows.sort((a, b) => (parseInt(a.track_number ?? '0') || 0) - (parseInt(b.track_number ?? '0') || 0))

  const tracks = trackRows.map((t) => ({
    id: t.id,
    title: t.title,
    track_number: t.track_number,
    duration: t.duration_sec,
    album: { id: album.id, title: album.title, artist: { id: artist.id, name: artist.name } },
    artist: { id: t.artist_id ?? artist.id, name: t.artist_name ?? artist.name },
    image_path: album.image_path,
    url: `${streamBase()}/stream/${t.id}`,
  }))

  const secondaryArtistRows = await db
    .selectFrom('artist_albums')
    .innerJoin('artists as sa', 'sa.id', 'artist_albums.artist_id')
    .select([
      'artist_albums.artist_id as id',
      'sa.name',
      'artist_albums.role',
    ])
    .where('artist_albums.album_id', '=', id)
    .where('artist_albums.role', '!=', 'primary')
    .orderBy('artist_albums.order', 'asc')
    .execute()

  const secondary_artists = secondaryArtistRows.map(r => ({ id: r.id, name: r.name, role: r.role }))

  const summary = await getAlbumSummary(
    artist.name,
    album.title,
    artist.wikipedia,
    album.wikipedia
  )

  return c.json({ album, artist, secondary_artists, tracks, summary: summary ?? {} })
})

export default albums
