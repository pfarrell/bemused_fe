import { Hono } from 'hono'
import { db } from '../db/database.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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

    return c.json(updated)
  } catch (error) {
    console.error('Error updating album:', error)
    return c.json({ error: 'Failed to update album' }, 500)
  }
})

// DELETE /admin/artist/:id — delete an artist
admin.delete('/artist/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  try {
    const deleted = await db
      .deleteFrom('artists')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!deleted) {
      return c.json({ error: 'Artist not found' }, 404)
    }

    return c.json({ success: true, deleted })
  } catch (error) {
    console.error('Error deleting artist:', error)
    return c.json({ error: 'Failed to delete artist' }, 500)
  }
})

// DELETE /admin/album/:id — delete an album
admin.delete('/album/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  try {
    const deleted = await db
      .deleteFrom('albums')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!deleted) {
      return c.json({ error: 'Album not found' }, 404)
    }

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

export default admin
