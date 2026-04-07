import { Hono } from 'hono'
import { db } from '../db/database.js'
import { sql } from 'kysely'
import { lookupAlbumMBID, lookupArtistMBID } from '../services/musicbrainz.js'
import { fetchArtistImageFromFanart } from '../services/fanart.js'
import { fetchSimilarArtists } from '../services/lastfmSimilar.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createSmallVersion } from '../services/imageResize.js'

const MBID_RETRYABLE = ['unmatched', 'not_found', 'low_confidence']

const admin = new Hono()

// Test route to verify admin routing works
admin.get('/test', (c) => {
  return c.json({ message: 'Admin GET routing works!' })
})

// Test POST route
admin.post('/test-post', (c) => {
  return c.json({ message: 'Admin POST routing works!' })
})

// Helper to get the project root directory
// Use environment variable or fall back to calculating from __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// In production, we're deployed to /var/www/bemused-node/current, use that
// In development, calculate from __dirname
const projectRoot = process.env.NODE_ENV === 'production'
  ? '/var/www/bemused-node/current'
  : path.resolve(__dirname, '../../..')

// PUT /admin/artist/:id — update an artist
admin.put('/artist/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()

  const { name, image_path, wikipedia } = body

  if (!name) {
    return c.json({ error: 'Name is required' }, 400)
  }

  try {
    const current = await db.selectFrom('artists').select(['name', 'mbid_status']).where('id', '=', id).executeTakeFirst()

    const updated = await db
      .updateTable('artists')
      .set({
        name,
        image_path: image_path || null,
        wikipedia: wikipedia || null,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!updated) {
      return c.json({ error: 'Artist not found' }, 404)
    }

    // Re-trigger MBID → image → similar-artists chain if name changed and status is retryable
    if (current && current.name !== name && MBID_RETRYABLE.includes(current.mbid_status ?? 'unmatched')) {
      const imagesDir = path.join(projectRoot, 'public', 'images')
      lookupArtistMBID(id, name).then(async result => {
        if (!result.mbid) return
        await fetchArtistImageFromFanart(id, result.mbid, imagesDir)
        await fetchSimilarArtists(id, name)
      }).catch(err =>
        console.warn(`Post-update lookup chain failed for artist ${id}:`, err.message)
      )
    }

    return c.json(updated)
  } catch (error) {
    console.error('Error updating artist:', error)
    return c.json({ error: 'Failed to update artist' }, 500)
  }
})

// PUT /admin/album/:id — update an album
admin.put('/album/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()

  const { title, artist_id, release_year, image_path, wikipedia } = body

  if (!title) {
    return c.json({ error: 'Title is required' }, 400)
  }

  if (!artist_id) {
    return c.json({ error: 'Artist ID is required' }, 400)
  }

  try {
    const current = await db
      .selectFrom('albums')
      .innerJoin('artists', 'artists.id', 'albums.artist_id')
      .select(['albums.title', 'albums.artist_id', 'albums.mbid_status', 'albums.release_year', 'artists.name as artist_name'])
      .where('albums.id', '=', id)
      .executeTakeFirst()

    const updated = await db
      .updateTable('albums')
      .set({
        title,
        artist_id,
        release_year: release_year || null,
        image_path: image_path || null,
        wikipedia: wikipedia || null,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!updated) {
      return c.json({ error: 'Album not found' }, 404)
    }

    // Re-trigger MBID lookup if matching fields changed and status is retryable
    if (current && MBID_RETRYABLE.includes(current.mbid_status ?? 'unmatched')) {
      const titleChanged = current.title !== title
      const artistChanged = current.artist_id !== artist_id
      if (titleChanged || artistChanged) {
        // Resolve the new artist name if artist changed
        const artistNamePromise = artistChanged
          ? db.selectFrom('artists').select('name').where('id', '=', artist_id).executeTakeFirst().then(r => r?.name ?? current.artist_name)
          : Promise.resolve(current.artist_name)

        artistNamePromise.then(artistName =>
          lookupAlbumMBID(id, title, artistName, undefined, release_year || null)
        ).catch(err =>
          console.warn(`MBID re-lookup failed for album ${id}:`, err.message)
        )
      }
    }

    return c.json(updated)
  } catch (error) {
    console.error('Error updating album:', error)
    return c.json({ error: 'Failed to update album' }, 500)
  }
})

// DELETE /admin/artist/:id — delete an artist and cascade to albums, tracks, media_files
admin.delete('/artist/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  try {
    const artist = await db.selectFrom('artists').select('id').where('id', '=', id).executeTakeFirst()
    if (!artist) return c.json({ error: 'Artist not found' }, 404)

    // Collect all albums for this artist
    const albums = await db.selectFrom('albums').select('id').where('artist_id', '=', id).execute()
    const albumIds = albums.map(a => a.id)

    if (albumIds.length > 0) {
      // Collect media_file IDs from tracks in those albums, then delete them
      const tracks = await db
        .selectFrom('tracks')
        .select(['id', 'media_file_id'])
        .where('album_id', 'in', albumIds)
        .execute()
      const mediaFileIds = tracks.map(t => t.media_file_id).filter((id): id is number => id != null)

      if (tracks.length > 0) {
        await db.deleteFrom('tracks').where('album_id', 'in', albumIds).execute()
      }
      if (mediaFileIds.length > 0) {
        await db.deleteFrom('media_files').where('id', 'in', mediaFileIds).execute()
      }
      await db.deleteFrom('albums').where('id', 'in', albumIds).execute()
    }

    const deleted = await db.deleteFrom('artists').where('id', '=', id).returningAll().executeTakeFirst()
    return c.json({ success: true, deleted })
  } catch (error) {
    console.error('Error deleting artist:', error)
    return c.json({ error: 'Failed to delete artist' }, 500)
  }
})

// DELETE /admin/album/:id — delete an album and cascade to tracks, media_files
admin.delete('/album/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  try {
    const album = await db.selectFrom('albums').select('id').where('id', '=', id).executeTakeFirst()
    if (!album) return c.json({ error: 'Album not found' }, 404)

    const tracks = await db
      .selectFrom('tracks')
      .select(['id', 'media_file_id'])
      .where('album_id', '=', id)
      .execute()
    const mediaFileIds = tracks.map(t => t.media_file_id).filter((id): id is number => id != null)

    if (tracks.length > 0) {
      await db.deleteFrom('tracks').where('album_id', '=', id).execute()
    }
    if (mediaFileIds.length > 0) {
      await db.deleteFrom('media_files').where('id', 'in', mediaFileIds).execute()
    }

    const deleted = await db.deleteFrom('albums').where('id', '=', id).returningAll().executeTakeFirst()
    return c.json({ success: true, deleted })
  } catch (error) {
    console.error('Error deleting album:', error)
    return c.json({ error: 'Failed to delete album' }, 500)
  }
})

// POST /admin/artist/:id/image — download and save artist image
admin.post('/artist/:id/image', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { image_url, image_name } = body

  if (!image_url || !image_name) {
    return c.json({ error: 'image_url and image_name are required' }, 400)
  }

  try {
    // Download the image
    console.log(`Downloading artist image from: ${image_url}`)
    const response = await fetch(image_url)
    if (!response.ok) {
      return c.json({ error: 'Failed to download image from URL' }, 400)
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    // Determine the image directory
    const imageDir = path.join(projectRoot, 'public', 'images', 'artists')
    console.log(`Saving artist image to directory: ${imageDir}`)

    // Create directory if it doesn't exist
    if (!fs.existsSync(imageDir)) {
      console.log(`Creating directory: ${imageDir}`)
      fs.mkdirSync(imageDir, { recursive: true })
    }

    // Save the image
    const imagePath = path.join(imageDir, image_name)
    console.log(`Writing artist image to: ${imagePath}`)
    fs.writeFileSync(imagePath, buffer)
    console.log(`Artist image saved successfully: ${imagePath}`)

    // Update the artist record
    const updated = await db
      .updateTable('artists')
      .set({
        image_path: image_name,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!updated) {
      return c.json({ error: 'Artist not found' }, 404)
    }

    return c.json({ success: true, artist: updated })
  } catch (error) {
    console.error('Error downloading/saving artist image:', error)
    return c.json({ error: 'Failed to save image' }, 500)
  }
})

// POST /admin/album/:id/image — download and save album image
admin.post('/album/:id/image', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { image_url, image_name } = body

  if (!image_url || !image_name) {
    return c.json({ error: 'image_url and image_name are required' }, 400)
  }

  try {
    // Download the image
    console.log(`Downloading album image from: ${image_url}`)
    const response = await fetch(image_url)
    if (!response.ok) {
      return c.json({ error: 'Failed to download image from URL' }, 400)
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    // Determine the image directory
    const imageDir = path.join(projectRoot, 'public', 'images', 'albums')
    console.log(`Saving album image to directory: ${imageDir}`)

    // Create directory if it doesn't exist
    if (!fs.existsSync(imageDir)) {
      console.log(`Creating directory: ${imageDir}`)
      fs.mkdirSync(imageDir, { recursive: true })
    }

    // Save the image
    const imagePath = path.join(imageDir, image_name)
    console.log(`Writing album image to: ${imagePath}`)
    fs.writeFileSync(imagePath, buffer)
    console.log(`Album image saved successfully: ${imagePath}`)

    // Update the album record
    const updated = await db
      .updateTable('albums')
      .set({
        image_path: image_name,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!updated) {
      return c.json({ error: 'Album not found' }, 404)
    }

    return c.json({ success: true, album: updated })
  } catch (error) {
    console.error('Error downloading/saving album image:', error)
    return c.json({ error: 'Failed to save image' }, 500)
  }
})

// POST /admin/playlist/:id/image — download and save playlist image
admin.post('/playlist/:id/image', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { image_url, image_name } = body

  if (!image_url || !image_name) {
    return c.json({ error: 'image_url and image_name are required' }, 400)
  }

  try {
    // Download the image
    console.log(`Downloading playlist image from: ${image_url}`)
    const response = await fetch(image_url)
    if (!response.ok) {
      return c.json({ error: 'Failed to download image from URL' }, 400)
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    // Determine the image directory (use albums directory for playlists too)
    const imageDir = path.join(projectRoot, 'public', 'images', 'albums')
    console.log(`Saving playlist image to directory: ${imageDir}`)

    // Create directory if it doesn't exist
    if (!fs.existsSync(imageDir)) {
      console.log(`Creating directory: ${imageDir}`)
      fs.mkdirSync(imageDir, { recursive: true })
    }

    // Save the image
    const imagePath = path.join(imageDir, image_name)
    console.log(`Writing playlist image to: ${imagePath}`)
    fs.writeFileSync(imagePath, buffer)
    console.log(`Playlist image saved successfully: ${imagePath}`)

    // Update the playlist record
    const updated = await db
      .updateTable('playlists')
      .set({
        image_path: image_name,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!updated) {
      return c.json({ error: 'Playlist not found' }, 404)
    }

    return c.json({ success: true, playlist: updated })
  } catch (error) {
    console.error('Error downloading/saving playlist image:', error)
    return c.json({ error: 'Failed to save image' }, 500)
  }
})

// PUT /admin/track/:id — update a track
admin.put('/track/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()

  const { title, track_number, album_id, artist_id } = body

  try {
    const updated = await db
      .updateTable('tracks')
      .set({
        ...(title !== undefined && { title }),
        ...(track_number !== undefined && { track_number }),
        ...(album_id !== undefined && { album_id }),
        ...(artist_id !== undefined && { artist_id }),
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!updated) {
      return c.json({ error: 'Track not found' }, 404)
    }

    return c.json(updated)
  } catch (error) {
    console.error('Error updating track:', error)
    return c.json({ error: 'Failed to update track' }, 500)
  }
})

// DELETE /admin/track/:id — delete a track
admin.delete('/track/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  try {
    const deleted = await db
      .deleteFrom('tracks')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!deleted) {
      return c.json({ error: 'Track not found' }, 404)
    }

    return c.json({ success: true, deleted })
  } catch (error) {
    console.error('Error deleting track:', error)
    return c.json({ error: 'Failed to delete track' }, 500)
  }
})

// PATCH /admin/album/:id/tracks — bulk update all tracks in an album
admin.patch('/album/:id/tracks', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()

  const { album_id, artist_id } = body

  try {
    // Get all tracks for this album
    const tracks = await db
      .selectFrom('tracks')
      .selectAll()
      .where('album_id', '=', id)
      .execute()

    if (!tracks || tracks.length === 0) {
      return c.json({ error: 'No tracks found for this album' }, 404)
    }

    // Update all tracks with the provided fields
    const updateData: any = {
      updated_at: new Date(),
    }

    if (album_id !== undefined) {
      updateData.album_id = album_id
    }

    if (artist_id !== undefined) {
      updateData.artist_id = artist_id
    }

    await db
      .updateTable('tracks')
      .set(updateData)
      .where('album_id', '=', id)
      .execute()

    return c.json({
      success: true,
      message: 'All tracks updated successfully',
      updated_count: tracks.length
    })
  } catch (error) {
    console.error('Error bulk updating tracks:', error)
    return c.json({ error: 'Failed to bulk update tracks' }, 500)
  }
})

// POST /admin/artist/:id/move-artifacts — move all albums and tracks to a new artist
admin.post('/artist/:id/move-artifacts', async (c) => {
  const sourceArtistId = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { target_artist_id } = body

  if (!target_artist_id) {
    return c.json({ error: 'target_artist_id is required' }, 400)
  }

  const targetArtistId = parseInt(target_artist_id)

  if (sourceArtistId === targetArtistId) {
    return c.json({ error: 'Source and target artists cannot be the same' }, 400)
  }

  try {
    // Verify both artists exist
    const sourceArtist = await db
      .selectFrom('artists')
      .select('id')
      .where('id', '=', sourceArtistId)
      .executeTakeFirst()

    if (!sourceArtist) {
      return c.json({ error: 'Source artist not found' }, 404)
    }

    const targetArtist = await db
      .selectFrom('artists')
      .select('id')
      .where('id', '=', targetArtistId)
      .executeTakeFirst()

    if (!targetArtist) {
      return c.json({ error: 'Target artist not found' }, 404)
    }

    // Update all albums
    const albumsResult = await db
      .updateTable('albums')
      .set({ artist_id: targetArtistId, updated_at: new Date() })
      .where('artist_id', '=', sourceArtistId)
      .execute()

    // Update all tracks
    const tracksResult = await db
      .updateTable('tracks')
      .set({ artist_id: targetArtistId, updated_at: new Date() })
      .where('artist_id', '=', sourceArtistId)
      .execute()

    return c.json({
      success: true,
      albums_moved: Number(albumsResult[0]?.numUpdatedRows || 0),
      tracks_moved: Number(tracksResult[0]?.numUpdatedRows || 0),
    })
  } catch (error) {
    console.error('Error moving artist artifacts:', error)
    return c.json({ error: 'Failed to move artifacts' }, 500)
  }
})

// POST /admin/album/:id/move-to-artist — move album and all its tracks to a new artist
admin.post('/album/:id/move-to-artist', async (c) => {
  const albumId = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { target_artist_id } = body

  if (!target_artist_id) {
    return c.json({ error: 'target_artist_id is required' }, 400)
  }

  const targetArtistId = parseInt(target_artist_id)

  try {
    // Verify album exists
    const album = await db
      .selectFrom('albums')
      .select(['id', 'artist_id'])
      .where('id', '=', albumId)
      .executeTakeFirst()

    if (!album) {
      return c.json({ error: 'Album not found' }, 404)
    }

    // Verify target artist exists
    const targetArtist = await db
      .selectFrom('artists')
      .select('id')
      .where('id', '=', targetArtistId)
      .executeTakeFirst()

    if (!targetArtist) {
      return c.json({ error: 'Target artist not found' }, 404)
    }

    // Update the album
    await db
      .updateTable('albums')
      .set({ artist_id: targetArtistId, updated_at: new Date() })
      .where('id', '=', albumId)
      .execute()

    // Update all tracks for this album
    const tracksResult = await db
      .updateTable('tracks')
      .set({ artist_id: targetArtistId, updated_at: new Date() })
      .where('album_id', '=', albumId)
      .execute()

    return c.json({
      success: true,
      tracks_moved: Number(tracksResult[0]?.numUpdatedRows || 0),
    })
  } catch (error) {
    console.error('Error moving album to new artist:', error)
    return c.json({ error: 'Failed to move album' }, 500)
  }
})

// POST /admin/album/:id/merge — merge all tracks into another album, then delete this album
// Body: { destination_album_id: number, track_offset: number }
// track_offset is added to each track's track_number (0 = no change)
// Track artist_id is updated to match destination album's artist, unless destination is Various Artists (id=161)
const VARIOUS_ARTISTS_ID = 161

admin.post('/album/:id/merge', async (c) => {
  const sourceAlbumId = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { destination_album_id, track_offset = 0 } = body

  if (!destination_album_id) return c.json({ error: 'destination_album_id is required' }, 400)
  if (sourceAlbumId === parseInt(destination_album_id)) return c.json({ error: 'Cannot merge an album into itself' }, 400)

  const destAlbum = await db
    .selectFrom('albums')
    .select(['id', 'artist_id'])
    .where('id', '=', parseInt(destination_album_id))
    .executeTakeFirst()

  if (!destAlbum) return c.json({ error: 'Destination album not found' }, 404)

  const sourceAlbum = await db
    .selectFrom('albums')
    .select('id')
    .where('id', '=', sourceAlbumId)
    .executeTakeFirst()

  if (!sourceAlbum) return c.json({ error: 'Source album not found' }, 404)

  try {
    const offset = parseInt(track_offset) || 0

    if (offset > 0) {
      await db
        .updateTable('tracks')
        .set({ track_number: sql`track_number::integer + ${offset}`, updated_at: new Date() })
        .where('album_id', '=', sourceAlbumId)
        .execute()
    }

    const updateSet: Record<string, any> = { album_id: destAlbum.id, updated_at: new Date() }
    if (destAlbum.artist_id !== VARIOUS_ARTISTS_ID) {
      updateSet.artist_id = destAlbum.artist_id
    }

    const result = await db
      .updateTable('tracks')
      .set(updateSet)
      .where('album_id', '=', sourceAlbumId)
      .execute()

    await db.deleteFrom('albums').where('id', '=', sourceAlbumId).execute()

    return c.json({ success: true, tracks_moved: Number(result[0]?.numUpdatedRows || 0) })
  } catch (error) {
    console.error('Error merging album:', error)
    return c.json({ error: 'Failed to merge album' }, 500)
  }
})

// GET /admin/album/:id/artists — list non-primary artists for an album
admin.get('/album/:id/artists', async (c) => {
  const id = parseInt(c.req.param('id'))
  try {
    const rows = await db
      .selectFrom('artist_albums')
      .innerJoin('artists', 'artists.id', 'artist_albums.artist_id')
      .select([
        'artist_albums.artist_id',
        'artist_albums.role',
        'artist_albums.order',
        'artists.name',
      ])
      .where('artist_albums.album_id', '=', id)
      .where('artist_albums.role', '!=', 'primary')
      .orderBy('artist_albums.order', 'asc')
      .execute()
    return c.json(rows)
  } catch (error) {
    console.error('Error fetching album artists:', error)
    return c.json({ error: 'Failed to fetch album artists' }, 500)
  }
})

// POST /admin/album/:id/artists — add a non-primary artist to an album
admin.post('/album/:id/artists', async (c) => {
  const albumId = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { artist_id, role } = body

  if (!artist_id || !role) {
    return c.json({ error: 'artist_id and role are required' }, 400)
  }
  if (!['compilation', 'featured', 'guest', 'collaborator'].includes(role)) {
    return c.json({ error: 'Invalid role. Must be compilation, featured, guest, or collaborator' }, 400)
  }

  try {
    const existing = await db
      .selectFrom('artist_albums')
      .select('order')
      .where('album_id', '=', albumId)
      .execute()
    const nextOrder = existing.length > 0 ? Math.max(...existing.map(r => r.order)) + 1 : 1

    const inserted = await db
      .insertInto('artist_albums')
      .values({ artist_id, album_id: albumId, role, order: nextOrder })
      .returningAll()
      .executeTakeFirst()

    return c.json(inserted)
  } catch (error: any) {
    if (error.code === '23505') {
      return c.json({ error: 'This artist is already associated with this album' }, 409)
    }
    console.error('Error adding artist to album:', error)
    return c.json({ error: 'Failed to add artist to album' }, 500)
  }
})

// DELETE /admin/album/:id/artists/:artist_id — remove a non-primary artist from an album
admin.delete('/album/:id/artists/:artist_id', async (c) => {
  const albumId = parseInt(c.req.param('id'))
  const artistId = parseInt(c.req.param('artist_id'))

  try {
    const deleted = await db
      .deleteFrom('artist_albums')
      .where('album_id', '=', albumId)
      .where('artist_id', '=', artistId)
      .where('role', '!=', 'primary')
      .returningAll()
      .executeTakeFirst()

    if (!deleted) {
      return c.json({ error: 'Relationship not found or cannot remove primary artist' }, 404)
    }
    return c.json({ success: true })
  } catch (error) {
    console.error('Error removing artist from album:', error)
    return c.json({ error: 'Failed to remove artist from album' }, 500)
  }
})

// GET /admin/artist/:id/albums — list non-primary albums for an artist
admin.get('/artist/:id/albums', async (c) => {
  const id = parseInt(c.req.param('id'))
  try {
    const rows = await db
      .selectFrom('artist_albums')
      .innerJoin('albums', 'albums.id', 'artist_albums.album_id')
      .select([
        'artist_albums.album_id',
        'artist_albums.role',
        'albums.title',
        'albums.release_year',
      ])
      .where('artist_albums.artist_id', '=', id)
      .where('artist_albums.role', '!=', 'primary')
      .orderBy('albums.release_year', 'asc')
      .execute()
    return c.json(rows)
  } catch (error) {
    console.error('Error fetching artist albums:', error)
    return c.json({ error: 'Failed to fetch artist albums' }, 500)
  }
})

// POST /admin/artist/:id/albums — add a non-primary album to an artist
admin.post('/artist/:id/albums', async (c) => {
  const artistId = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { album_id, role } = body

  if (!album_id || !role) {
    return c.json({ error: 'album_id and role are required' }, 400)
  }
  if (!['compilation', 'featured', 'guest', 'collaborator'].includes(role)) {
    return c.json({ error: 'Invalid role. Must be compilation, featured, guest, or collaborator' }, 400)
  }

  try {
    const existing = await db
      .selectFrom('artist_albums')
      .select('order')
      .where('album_id', '=', album_id)
      .execute()
    const nextOrder = existing.length > 0 ? Math.max(...existing.map(r => r.order)) + 1 : 1

    const inserted = await db
      .insertInto('artist_albums')
      .values({ artist_id: artistId, album_id, role, order: nextOrder })
      .returningAll()
      .executeTakeFirst()

    return c.json(inserted)
  } catch (error: any) {
    if (error.code === '23505') {
      return c.json({ error: 'This artist is already associated with this album' }, 409)
    }
    console.error('Error adding album to artist:', error)
    return c.json({ error: 'Failed to add album to artist' }, 500)
  }
})

// DELETE /admin/artist/:id/albums/:album_id — remove a non-primary album from an artist
admin.delete('/artist/:id/albums/:album_id', async (c) => {
  const artistId = parseInt(c.req.param('id'))
  const albumId = parseInt(c.req.param('album_id'))

  try {
    const deleted = await db
      .deleteFrom('artist_albums')
      .where('artist_id', '=', artistId)
      .where('album_id', '=', albumId)
      .where('role', '!=', 'primary')
      .returningAll()
      .executeTakeFirst()

    if (!deleted) {
      return c.json({ error: 'Relationship not found or cannot remove primary relationship' }, 404)
    }
    return c.json({ success: true })
  } catch (error) {
    console.error('Error removing album from artist:', error)
    return c.json({ error: 'Failed to remove album from artist' }, 500)
  }
})

// GET /admin/artist/:id/related — list related artists and members
admin.get('/artist/:id/related', async (c) => {
  const id = parseInt(c.req.param('id'))
  try {
    const rows = await db
      .selectFrom('artist_relations')
      .innerJoin('artists', 'artists.id', 'artist_relations.related_artist_id')
      .select(['artists.id', 'artists.name', 'artist_relations.kind', 'artist_relations.source', 'artist_relations.similarity'])
      .where('artist_relations.artist_id', '=', id)
      .where('artist_relations.source', '=', 'manual')
      .orderBy('artist_relations.similarity', 'desc')
      .orderBy('artists.name', 'asc')
      .execute()
    return c.json(rows)
  } catch (error) {
    console.error('Error fetching related artists:', error)
    return c.json({ error: 'Failed to fetch related artists' }, 500)
  }
})

// POST /admin/artist/:id/related — add relation (symmetric for 'related', one-directional for 'member')
admin.post('/artist/:id/related', async (c) => {
  const artistId = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const relatedId = parseInt(body.related_artist_id)
  const kind: string = body.kind ?? 'related'

  if (!relatedId || isNaN(relatedId)) {
    return c.json({ error: 'related_artist_id is required' }, 400)
  }
  if (artistId === relatedId) {
    return c.json({ error: 'An artist cannot be related to itself' }, 400)
  }

  try {
    const rows = kind === 'member'
      ? [{ artist_id: artistId, related_artist_id: relatedId, kind, source: 'manual', similarity: 1.0 }]
      : [
          { artist_id: artistId, related_artist_id: relatedId, kind, source: 'manual', similarity: 1.0 },
          { artist_id: relatedId, related_artist_id: artistId, kind, source: 'manual', similarity: 1.0 },
        ]

    await db
      .insertInto('artist_relations')
      .values(rows)
      .onConflict((oc) => oc.doNothing())
      .execute()

    return c.json({ success: true })
  } catch (error) {
    console.error('Error adding related artist:', error)
    return c.json({ error: 'Failed to add related artist' }, 500)
  }
})

// DELETE /admin/artist/:id/related/:related_id — remove relation
admin.delete('/artist/:id/related/:related_id', async (c) => {
  const artistId = parseInt(c.req.param('id'))
  const relatedId = parseInt(c.req.param('related_id'))

  try {
    // Look up the kind to determine if we remove one or both directions
    const existing = await db
      .selectFrom('artist_relations')
      .select('kind')
      .where('artist_id', '=', artistId)
      .where('related_artist_id', '=', relatedId)
      .executeTakeFirst()

    const kind = existing?.kind ?? 'related'

    if (kind === 'member') {
      // One-directional: only remove artistId → relatedId
      await db
        .deleteFrom('artist_relations')
        .where('artist_id', '=', artistId)
        .where('related_artist_id', '=', relatedId)
        .execute()
    } else {
      // Symmetric: remove both directions
      await db
        .deleteFrom('artist_relations')
        .where((eb) =>
          eb.or([
            eb.and([
              eb('artist_id', '=', artistId),
              eb('related_artist_id', '=', relatedId),
            ]),
            eb.and([
              eb('artist_id', '=', relatedId),
              eb('related_artist_id', '=', artistId),
            ]),
          ])
        )
        .execute()
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Error removing related artist:', error)
    return c.json({ error: 'Failed to remove related artist' }, 500)
  }
})

// --- Image management helpers ---

type EntityKind = 'album' | 'artist'

async function getImagesForEntity(entityKind: EntityKind, entityId: number) {
  const field = entityKind === 'album' ? 'album_id' : 'artist_id'
  return db
    .selectFrom('images')
    .leftJoin('media_files', (join) =>
      join
        .onRef('media_files.entity_id', '=', 'images.id')
        .on('media_files.entity_type', '=', 'image')
    )
    .select([
      'images.id',
      'images.is_primary',
      'images.source',
      'images.status',
      'images.width',
      'images.height',
      'images.created_at',
      'media_files.absolute_path as path',
    ])
    .where(`images.${field}` as any, '=', entityId)
    .orderBy('images.is_primary', 'desc')
    .orderBy('images.created_at', 'asc')
    .execute()
}

async function downloadAndSaveImage(
  imageUrl: string,
  imageName: string,
  subdir: 'albums' | 'artists'
): Promise<string> {
  const response = await fetch(imageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bemused/1.0)' }
  })
  if (!response.ok) throw new Error(`Failed to download image: ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  const imageDir = path.join(projectRoot, 'public', 'images', subdir)
  if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true })
  const imagePath = path.join(imageDir, imageName)
  fs.writeFileSync(imagePath, buffer)
  await createSmallVersion(imagePath)
  return imageName
}

async function createImageRecord(
  entityKind: EntityKind,
  entityId: number,
  filePath: string,
  source: string,
  isPrimary: boolean,
  status: string = 'active'
) {
  const image = await db
    .insertInto('images')
    .values({
      ...(entityKind === 'album' ? { album_id: entityId } : { artist_id: entityId }),
      is_primary: isPrimary,
      source,
      status,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  await db
    .insertInto('media_files')
    .values({
      entity_type: 'image',
      entity_id: image.id,
      discriminator: 'image',
      absolute_path: filePath,
      name: filePath,
      file_type: 'image',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute()

  // If primary, sync image_path on the parent record and clear other primaries
  if (isPrimary) {
    await db
      .updateTable('images')
      .set({ is_primary: false })
      .where(entityKind === 'album' ? 'album_id' : 'artist_id', '=', entityId)
      .where('id', '!=', image.id)
      .execute()

    if (entityKind === 'album') {
      await db.updateTable('albums').set({ image_path: filePath, updated_at: new Date() }).where('id', '=', entityId).execute()
    } else {
      await db.updateTable('artists').set({ image_path: filePath, updated_at: new Date() }).where('id', '=', entityId).execute()
    }
  }

  return image
}

// GET /admin/album/:id/images
admin.get('/album/:id/images', async (c) => {
  const id = parseInt(c.req.param('id'))
  const images = await getImagesForEntity('album', id)
  return c.json(images)
})

// POST /admin/album/:id/images — download and add a new image
admin.post('/album/:id/images', async (c) => {
  const id = parseInt(c.req.param('id'))
  const { image_url, image_name, set_primary = false } = await c.req.json()
  if (!image_url || !image_name) return c.json({ error: 'image_url and image_name are required' }, 400)

  try {
    const filePath = await downloadAndSaveImage(image_url, image_name, 'albums')
    const image = await createImageRecord('album', id, filePath, 'manual', set_primary)
    return c.json({ success: true, image })
  } catch (err) {
    console.error('Error adding album image:', err)
    return c.json({ error: 'Failed to save image' }, 500)
  }
})

// PATCH /admin/album/:id/images/:imgId/primary — set as primary
admin.patch('/album/:id/images/:imgId/primary', async (c) => {
  const albumId = parseInt(c.req.param('id'))
  const imgId = parseInt(c.req.param('imgId'))

  try {
    // Clear existing primary
    await db.updateTable('images').set({ is_primary: false }).where('album_id', '=', albumId).execute()
    // Set new primary
    const image = await db
      .updateTable('images')
      .set({ is_primary: true })
      .where('id', '=', imgId)
      .where('album_id', '=', albumId)
      .returningAll()
      .executeTakeFirst()

    if (!image) return c.json({ error: 'Image not found' }, 404)

    // Sync image_path
    const mf = await db.selectFrom('media_files').select('absolute_path').where('entity_type', '=', 'image').where('entity_id', '=', imgId).executeTakeFirst()
    if (mf?.absolute_path) {
      await db.updateTable('albums').set({ image_path: mf.absolute_path, updated_at: new Date() }).where('id', '=', albumId).execute()
    }

    return c.json({ success: true, image })
  } catch (err) {
    console.error('Error setting primary image:', err)
    return c.json({ error: 'Failed to set primary image' }, 500)
  }
})

// DELETE /admin/album/:id/images/:imgId
admin.delete('/album/:id/images/:imgId', async (c) => {
  const albumId = parseInt(c.req.param('id'))
  const imgId = parseInt(c.req.param('imgId'))

  try {
    const image = await db.deleteFrom('images').where('id', '=', imgId).where('album_id', '=', albumId).returningAll().executeTakeFirst()
    if (!image) return c.json({ error: 'Image not found' }, 404)
    await db.deleteFrom('media_files').where('entity_type', '=', 'image').where('entity_id', '=', imgId).execute()
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Failed to delete image' }, 500)
  }
})

// GET /admin/artist/:id/images
admin.get('/artist/:id/images', async (c) => {
  const id = parseInt(c.req.param('id'))
  const images = await getImagesForEntity('artist', id)
  return c.json(images)
})

// POST /admin/artist/:id/images
admin.post('/artist/:id/images', async (c) => {
  const id = parseInt(c.req.param('id'))
  const { image_url, image_name, set_primary = false } = await c.req.json()
  if (!image_url || !image_name) return c.json({ error: 'image_url and image_name are required' }, 400)

  try {
    const filePath = await downloadAndSaveImage(image_url, image_name, 'artists')
    const image = await createImageRecord('artist', id, filePath, 'manual', set_primary)
    return c.json({ success: true, image })
  } catch (err) {
    return c.json({ error: (err as Error).message || 'Failed to save image' }, 500)
  }
})

// PATCH /admin/artist/:id/images/:imgId/primary
admin.patch('/artist/:id/images/:imgId/primary', async (c) => {
  const artistId = parseInt(c.req.param('id'))
  const imgId = parseInt(c.req.param('imgId'))

  try {
    await db.updateTable('images').set({ is_primary: false }).where('artist_id', '=', artistId).execute()
    const image = await db
      .updateTable('images')
      .set({ is_primary: true })
      .where('id', '=', imgId)
      .where('artist_id', '=', artistId)
      .returningAll()
      .executeTakeFirst()

    if (!image) return c.json({ error: 'Image not found' }, 404)

    const mf = await db.selectFrom('media_files').select('absolute_path').where('entity_type', '=', 'image').where('entity_id', '=', imgId).executeTakeFirst()
    if (mf?.absolute_path) {
      await db.updateTable('artists').set({ image_path: mf.absolute_path, updated_at: new Date() }).where('id', '=', artistId).execute()
    }

    return c.json({ success: true, image })
  } catch (err) {
    return c.json({ error: 'Failed to set primary image' }, 500)
  }
})

// DELETE /admin/artist/:id/images/:imgId
admin.delete('/artist/:id/images/:imgId', async (c) => {
  const artistId = parseInt(c.req.param('id'))
  const imgId = parseInt(c.req.param('imgId'))

  try {
    const image = await db.deleteFrom('images').where('id', '=', imgId).where('artist_id', '=', artistId).returningAll().executeTakeFirst()
    if (!image) return c.json({ error: 'Image not found' }, 404)
    await db.deleteFrom('media_files').where('entity_type', '=', 'image').where('entity_id', '=', imgId).execute()
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Failed to delete image' }, 500)
  }
})

export default admin
