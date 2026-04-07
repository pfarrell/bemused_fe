// server/src/services/fanart.ts
// Fanart.tv API — artist images keyed by MusicBrainz ID
//
// source values used:
//   'fanart'            — artistthumb photos
//   'fanart_logo'       — musiclogo / hdmusiclogo (transparent wordmarks)
//   'fanart_background' — artistbackground (wallpapers)
//   'fanart_banner'     — artistbanner (banners)

import { db } from '../db/database.js'
import fs from 'fs'
import path from 'path'
import { createSmallVersion } from './imageResize.js'

const FANART_BASE = 'https://webservice.fanart.tv/v3/music'
const USER_AGENT = 'Bemused/1.0 (https://patf.net)'

interface FanartThumb {
  id: string
  url: string
  likes: string
}

interface FanartResponse {
  artistthumb?: FanartThumb[]
  hdmusiclogo?: FanartThumb[]
  musiclogo?: FanartThumb[]
  artistbackground?: FanartThumb[]
  artistbanner?: FanartThumb[]
}

async function downloadImage(url: string, dir: string, filename: string): Promise<void> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, filename), buffer)
}

async function saveImageRecord(
  artistId: number,
  filename: string,
  source: string,
  isPrimary: boolean
): Promise<void> {
  const image = await db
    .insertInto('images')
    .values({ artist_id: artistId, is_primary: isPrimary, source, status: 'active' })
    .returningAll()
    .executeTakeFirstOrThrow()

  await db
    .insertInto('media_files')
    .values({
      entity_type: 'image',
      entity_id: image.id,
      discriminator: 'image',
      absolute_path: filename,
      name: filename,
      file_type: 'image',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute()

  if (isPrimary) {
    await db.updateTable('artists')
      .set({ image_path: filename, updated_at: new Date() })
      .where('id', '=', artistId)
      .execute()
  }
}

export interface FanartResult {
  downloaded: number
  existing: number
}

export async function fetchArtistImageFromFanart(
  artistId: number,
  mbid: string,
  imagesDir: string,
  limit = 10
): Promise<FanartResult> {
  const apiKey = process.env.FANART_API_KEY
  if (!apiKey) {
    console.warn('  ⚠️  FANART_API_KEY not set, skipping artist image fetch')
    return { downloaded: 0, existing: 0 }
  }

  let data: FanartResponse
  try {
    const res = await fetch(`${FANART_BASE}/${mbid}?api_key=${apiKey}`, {
      headers: { 'User-Agent': USER_AGENT }
    })
    if (res.status === 404) {
      await markNotFound(artistId)
      console.log(`  ℹ️  No Fanart.tv entry for artist ${artistId} (${mbid})`)
      return { downloaded: 0, existing: 0 }
    }
    if (!res.ok) throw new Error(`Fanart.tv error: ${res.status}`)
    data = await res.json()
  } catch (err) {
    console.warn(`  ⚠️  Fanart.tv fetch failed for artist ${artistId}: ${(err as Error).message}`)
    return { downloaded: 0, existing: 0 }
  }

  const thumbs = (data.artistthumb ?? []).sort((a, b) => parseInt(b.likes) - parseInt(a.likes)).slice(0, limit)
  const logos = [
    ...(data.hdmusiclogo ?? []).map(l => ({ ...l, type: 'hd' })),
    ...(data.musiclogo ?? []).map(l => ({ ...l, type: 'sd' })),
  ].sort((a, b) => parseInt(b.likes) - parseInt(a.likes)).slice(0, limit)
  const backgrounds = (data.artistbackground ?? []).sort((a, b) => parseInt(b.likes) - parseInt(a.likes)).slice(0, limit)
  const banners = (data.artistbanner ?? []).sort((a, b) => parseInt(b.likes) - parseInt(a.likes)).slice(0, limit)

  if (thumbs.length === 0 && logos.length === 0 && backgrounds.length === 0 && banners.length === 0) {
    await markNotFound(artistId)
    console.log(`  ℹ️  No Fanart.tv images for artist ${artistId} (${mbid})`)
    return { downloaded: 0, existing: 0 }
  }

  const artistDir = path.join(imagesDir, 'artists')
  let downloaded = 0
  let existing = 0

  // Determine if we need to set a primary
  const existingPrimary = await db
    .selectFrom('images')
    .select('id')
    .where('artist_id', '=', artistId)
    .where('is_primary', '=', true)
    .executeTakeFirst()
  let primarySet = !!existingPrimary

  // Save all artist thumbnails
  for (const thumb of thumbs) {
    const ext = thumb.url.split('.').pop()?.split('?')[0] ?? 'jpg'
    const filename = `artist_${artistId}_fanart_${thumb.id}.${ext}`
    const alreadyExists = await db.selectFrom('media_files').select('id').where('absolute_path', '=', filename).executeTakeFirst()
    if (alreadyExists) { existing++; continue }
    try {
      await downloadImage(thumb.url, artistDir, filename)
      await createSmallVersion(path.join(artistDir, filename))
      const isPrimary = !primarySet
      await saveImageRecord(artistId, filename, 'fanart', isPrimary)
      if (isPrimary) {
        primarySet = true
        console.log(`  ✅ New thumb (primary): ${filename}`)
      } else {
        console.log(`  ✅ New thumb: ${filename}`)
      }
      downloaded++
    } catch (err) {
      console.warn(`  ⚠️  Failed to save thumb ${thumb.id}: ${(err as Error).message}`)
    }
  }

  // Save all backgrounds (eligible for primary — preferred over thumbs being absent)
  for (const bg of backgrounds) {
    const ext = bg.url.split('.').pop()?.split('?')[0] ?? 'jpg'
    const filename = `artist_${artistId}_fanart_bg_${bg.id}.${ext}`
    const alreadyExists = await db.selectFrom('media_files').select('id').where('absolute_path', '=', filename).executeTakeFirst()
    if (alreadyExists) { existing++; continue }
    try {
      await downloadImage(bg.url, artistDir, filename)
      const isPrimary = !primarySet
      await saveImageRecord(artistId, filename, 'fanart_background', isPrimary)
      if (isPrimary) {
        primarySet = true
        console.log(`  ✅ New background (primary): ${filename}`)
      } else {
        console.log(`  ✅ New background: ${filename}`)
      }
      downloaded++
    } catch (err) {
      console.warn(`  ⚠️  Failed to save background ${bg.id}: ${(err as Error).message}`)
    }
  }

  // Save all banners (eligible for primary — preferred over having no image at all)
  for (const banner of banners) {
    const ext = banner.url.split('.').pop()?.split('?')[0] ?? 'jpg'
    const filename = `artist_${artistId}_fanart_banner_${banner.id}.${ext}`
    const alreadyExists = await db.selectFrom('media_files').select('id').where('absolute_path', '=', filename).executeTakeFirst()
    if (alreadyExists) { existing++; continue }
    try {
      await downloadImage(banner.url, artistDir, filename)
      const isPrimary = !primarySet
      await saveImageRecord(artistId, filename, 'fanart_banner', isPrimary)
      if (isPrimary) {
        primarySet = true
        console.log(`  ✅ New banner (primary): ${filename}`)
      } else {
        console.log(`  ✅ New banner: ${filename}`)
      }
      downloaded++
    } catch (err) {
      console.warn(`  ⚠️  Failed to save banner ${banner.id}: ${(err as Error).message}`)
    }
  }

  // Save all logos (not eligible for primary — logos are not artist photos)
  for (const logo of logos) {
    const ext = logo.url.split('.').pop()?.split('?')[0] ?? 'png'
    const filename = `artist_${artistId}_fanart_logo_${logo.id}.${ext}`
    const alreadyExists = await db.selectFrom('media_files').select('id').where('absolute_path', '=', filename).executeTakeFirst()
    if (alreadyExists) { existing++; continue }
    try {
      await downloadImage(logo.url, artistDir, filename)
      await saveImageRecord(artistId, filename, 'fanart_logo', false)
      console.log(`  ✅ New logo: ${filename}`)
      downloaded++
    } catch (err) {
      console.warn(`  ⚠️  Failed to save logo ${logo.id}: ${(err as Error).message}`)
    }
  }

  if (downloaded === 0 && existing === 0) await markNotFound(artistId)
  return { downloaded, existing }
}

async function markNotFound(artistId: number) {
  await db
    .insertInto('images')
    .values({ artist_id: artistId, is_primary: false, source: 'fanart', status: 'not_found' })
    .execute()
}
