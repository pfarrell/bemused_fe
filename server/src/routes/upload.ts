import { Hono } from 'hono'
import { db } from '../db/database.js'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const upload = new Hono()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Helper to get upload directory
const getUploadDir = () => {
  const projectRoot = process.env.NODE_ENV === 'production'
    ? '/var/www/bemused-node/current'
    : path.resolve(__dirname, '../../..')

  const uploadDir = path.join(projectRoot, 'public', 'tmp', 'uploads')

  // Create directory if it doesn't exist
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }

  return uploadDir
}

// Helper to calculate MD5 hash of a file
const calculateFileHash = (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(filePath)

    stream.on('data', (data) => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

// POST /admin/upload - Upload audio files
upload.post('/', async (c) => {
  try {
    // Parse body with larger size limit (2GB)
    const body = await c.req.parseBody({
      all: true,
      maxSize: 2 * 1024 * 1024 * 1024 // 2GB
    })

    // Extract form fields
    const artistInput = body.artist_name as string | undefined
    const albumInput = body.album_name as string | undefined

    // Determine if artist input is an ID (numeric) or name
    let artistName: string | null = null
    let artistId: number | null = null
    if (artistInput) {
      const parsedArtistId = parseInt(artistInput)
      if (!isNaN(parsedArtistId) && parsedArtistId.toString() === artistInput.trim()) {
        artistId = parsedArtistId
      } else {
        artistName = artistInput
      }
    }

    // Determine if album input is an ID (numeric) or name
    let albumName: string | null = null
    let albumId: number | null = null
    if (albumInput) {
      const parsedAlbumId = parseInt(albumInput)
      if (!isNaN(parsedAlbumId) && parsedAlbumId.toString() === albumInput.trim()) {
        albumId = parsedAlbumId
      } else {
        albumName = albumInput
      }
    }

    const genre = body.genre as string | undefined
    const trackPad = body.track_pad ? parseInt(body.track_pad as string) : 0
    const albumArtUrl = body.album_art_url as string | undefined
    const albumArtName = body.album_art_name as string | undefined

    // Get uploaded files
    const files = body.files
    if (!files) {
      return c.json({ error: 'No files uploaded' }, 400)
    }

    // Handle single file or array of files
    const fileArray = Array.isArray(files) ? files : [files]

    const uploadDir = getUploadDir()
    const queuedFiles: any[] = []

    // Process each uploaded file
    for (const file of fileArray) {
      if (typeof file === 'string') continue // Skip non-file fields

      // Read file buffer
      const buffer = await file.arrayBuffer()
      const fileBuffer = Buffer.from(buffer)

      // Save to temporary upload directory
      const filename = file.name || `upload_${Date.now()}.mp3`
      const filePath = path.join(uploadDir, filename)

      fs.writeFileSync(filePath, fileBuffer)

      // Calculate MD5 hash
      const fileHash = await calculateFileHash(filePath)

      // Check if file already exists in database
      const existingFile = await db
        .selectFrom('media_files')
        .select('id')
        .where('file_hash', '=', fileHash)
        .executeTakeFirst()

      if (existingFile) {
        console.log(`Skipping duplicate file: ${filename} (hash: ${fileHash})`)
        // Delete the uploaded file since it's a duplicate
        fs.unlinkSync(filePath)
        continue
      }

      // Add to upload queue
      const queueEntry = await db
        .insertInto('upload_queue')
        .values({
          status: 'pending',
          artist_name: artistName || null,
          artist_id: artistId,
          album_name: albumName || null,
          album_id: albumId,
          genre: genre || null,
          track_pad: trackPad || 0,
          file_path: filePath,
          original_filename: filename,
          file_hash: fileHash,
          file_size: fileBuffer.length,
          album_art_url: albumArtUrl || null,
          album_art_path: albumArtName || null,
        })
        .returningAll()
        .executeTakeFirst()

      queuedFiles.push({
        id: queueEntry?.id,
        filename,
        hash: fileHash,
        size: fileBuffer.length,
      })
    }

    return c.json({
      success: true,
      queued: queuedFiles.length,
      files: queuedFiles,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return c.json({ error: 'Failed to process upload' }, 500)
  }
})

// GET /admin/upload/status - Get status of upload queue
upload.get('/status', async (c) => {
  try {
    const stats = await db
      .selectFrom('upload_queue')
      .select((eb) => [
        eb.fn.count('id').filterWhere('status', '=', 'pending').as('pending'),
        eb.fn.count('id').filterWhere('status', '=', 'processing').as('processing'),
        eb.fn.count('id').filterWhere('status', '=', 'completed').as('completed'),
        eb.fn.count('id').filterWhere('status', '=', 'failed').as('failed'),
      ])
      .executeTakeFirst()

    const recentJobs = await db
      .selectFrom('upload_queue')
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(20)
      .execute()

    return c.json({
      stats,
      recent: recentJobs,
    })
  } catch (error) {
    console.error('Status error:', error)
    return c.json({ error: 'Failed to get upload status' }, 500)
  }
})

// GET /admin/upload/recent - Get recent uploads
upload.get('/recent', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50')

    // Hide completed uploads after 30 seconds (but keep pending/processing/failed)
    const thirtySecondsAgo = new Date(Date.now() - 30000)

    const recent = await db
      .selectFrom('upload_queue')
      .selectAll()
      .where((eb) =>
        eb.or([
          eb('status', '!=', 'completed'),
          eb('completed_at', '>', thirtySecondsAgo)
        ])
      )
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute()

    return c.json(recent)
  } catch (error) {
    console.error('Recent uploads error:', error)
    return c.json({ error: 'Failed to get recent uploads' }, 500)
  }
})

export default upload
