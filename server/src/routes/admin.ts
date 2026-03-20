import { Hono } from 'hono'
import { db } from '../db/database.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const admin = new Hono()

// Helper to get the project root directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../..')

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
    const response = await fetch(image_url)
    if (!response.ok) {
      return c.json({ error: 'Failed to download image from URL' }, 400)
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    // Determine the image directory
    const imageDir = path.join(projectRoot, 'public', 'images', 'artists')

    // Create directory if it doesn't exist
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true })
    }

    // Save the image
    const imagePath = path.join(imageDir, image_name)
    fs.writeFileSync(imagePath, buffer)

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
    const response = await fetch(image_url)
    if (!response.ok) {
      return c.json({ error: 'Failed to download image from URL' }, 400)
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    // Determine the image directory
    const imageDir = path.join(projectRoot, 'public', 'images', 'albums')

    // Create directory if it doesn't exist
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true })
    }

    // Save the image
    const imagePath = path.join(imageDir, image_name)
    fs.writeFileSync(imagePath, buffer)

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

export default admin
