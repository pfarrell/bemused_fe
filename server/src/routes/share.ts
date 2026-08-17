import { Hono } from 'hono'
import type { Context } from 'hono'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { db } from '../db/database.js'
import { albumsService } from '../services/albumsService.js'
import { isLanHost } from '../db/streamUrl.js'
import { buildShareTags, injectMetaTags } from '../services/shareMeta.js'
import type { ShareEntity, ShareEntityType } from '../services/shareMeta.js'

const share = new Hono()

const FRONTEND_DIST_PATH = process.env.FRONTEND_DIST_PATH ?? '/var/www/bemused/shared/public/frontend'

// Minimal static message for the rare case index.html itself can't be read
// (bad path, permissions, mid-deploy race) — see design's error handling section.
// This deliberately does NOT reference any JS bundle path: the production entry
// script is content-hashed (e.g. /pshare/app/assets/index-BQU47q2r.js) and changes
// every build, so if we could read that hash we could have just read index.html itself.
const FALLBACK_HTML = '<!doctype html><html><head><title>P·Share</title></head><body><p>P·Share is temporarily unavailable. Please try again shortly.</p></body></html>'

function resolveHostProto(c: Context): { host: string; proto: string } {
  if (isLanHost(c)) return { host: '172.16.1.10', proto: 'http' }
  const host = (c.req.header('host') || 'patf.com').split(':')[0]
  const proto = c.req.header('x-forwarded-proto') || 'https'
  return { host, proto }
}

async function loadEntity(type: ShareEntityType, id: number): Promise<ShareEntity | null> {
  if (type === 'album') {
    const album = await albumsService.findAlbumById(id)
    if (!album) return null
    const artist = await albumsService.findArtistById(album.artist_id)
    return {
      type,
      id,
      title: album.title,
      description: artist ? `${album.title} by ${artist.name}` : album.title,
      imagePath: album.image_path,
    }
  }

  if (type === 'artist') {
    const artist = await db
      .selectFrom('artists')
      .select(['name', 'image_path'])
      .where('id', '=', id)
      .executeTakeFirst()
    if (!artist) return null
    return { type, id, title: artist.name, description: artist.name, imagePath: artist.image_path }
  }

  const playlist = await db
    .selectFrom('playlists')
    .select(['name', 'image_path'])
    .where('id', '=', id)
    .executeTakeFirst()
  if (!playlist) return null
  return { type, id, title: playlist.name, description: `${playlist.name} playlist`, imagePath: playlist.image_path }
}

share.get('/:type/:id', async (c) => {
  const type = c.req.param('type') as string
  if (type !== 'album' && type !== 'artist' && type !== 'playlist') {
    return c.text('Not found', 400)
  }

  const id = parseInt(c.req.param('id'))

  let html: string
  try {
    html = await readFile(path.join(FRONTEND_DIST_PATH, 'index.html'), 'utf-8')
  } catch (err) {
    console.error('share: failed to read index.html', err)
    return c.html(FALLBACK_HTML)
  }

  try {
    const entity = await loadEntity(type, id)
    if (!entity) return c.html(html)

    const { host, proto } = resolveHostProto(c)
    const tags = buildShareTags(entity, host, proto)
    return c.html(injectMetaTags(html, tags))
  } catch (err) {
    console.error('share: failed to build share tags', err)
    return c.html(html)
  }
})

export default share
