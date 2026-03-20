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
    .orderBy('tracks.track_number', 'asc')
    .execute()

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

  const summary = await getAlbumSummary(
    artist.name,
    album.title,
    artist.wikipedia,
    album.wikipedia
  )

  return c.json({ album, artist, tracks, summary: summary ?? {} })
})

export default albums
