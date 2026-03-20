import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import { db } from '../db/database.js'
import fs from 'fs'
import path from 'path'

const streams = new Hono()

// GET /stream/:id  — stream an audio file with range request support
streams.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  const track = await db
    .selectFrom('tracks')
    .leftJoin('media_files', 'media_files.id', 'tracks.media_file_id')
    .select(['media_files.absolute_path'])
    .where('tracks.id', '=', id)
    .executeTakeFirst()

  if (!track?.absolute_path) return c.json({ error: 'Track not found' }, 404)

  // Dev mode: proxy streams to the production server when NAS is unavailable
  const devStreamBase = process.env.BEMUSED_DEV
  if (devStreamBase) {
    const upstream = `${devStreamBase}/stream/${id}`
    const headers: Record<string, string> = { 'Content-Type': 'audio/mpeg' }
    const range = c.req.header('range')
    if (range) headers['Range'] = range

    const proxyRes = await fetch(upstream, { headers })
    return new Response(proxyRes.body, {
      status: proxyRes.status,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes',
        ...(proxyRes.headers.get('content-range') ? { 'Content-Range': proxyRes.headers.get('content-range')! } : {}),
        ...(proxyRes.headers.get('content-length') ? { 'Content-Length': proxyRes.headers.get('content-length')! } : {}),
      },
    })
  }

  const filePath = path.resolve(track.absolute_path)

  let stat: fs.Stats
  try {
    stat = fs.statSync(filePath)
  } catch {
    return c.json({ error: 'File not found' }, 404)
  }

  const fileSize = stat.size
  const rangeHeader = c.req.header('range')

  if (rangeHeader) {
    const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-')
    const start = parseInt(startStr, 10)
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1
    const chunkSize = end - start + 1

    return stream(c, async (stream) => {
      c.header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
      c.header('Accept-Ranges', 'bytes')
      c.header('Content-Length', String(chunkSize))
      c.header('Content-Type', 'audio/mpeg')
      c.status(206)

      const readStream = fs.createReadStream(filePath, { start, end })

      for await (const chunk of readStream) {
        await stream.write(chunk)
      }
    })
  }

  // No range — stream the whole file
  return stream(c, async (stream) => {
    c.header('Content-Length', String(fileSize))
    c.header('Content-Type', 'audio/mpeg')
    c.header('Accept-Ranges', 'bytes')

    const readStream = fs.createReadStream(filePath)

    for await (const chunk of readStream) {
      await stream.write(chunk)
    }
  })
})

export default streams
