// server/src/services/coverArtArchive.ts

import { db } from '../db/database.js'
import fs from 'fs'
import path from 'path'

const CAA_BASE = 'https://coverartarchive.org'
const USER_AGENT = 'Bemused/1.0 (https://patf.net)'

interface CAAImage {
  id: string
  types: string[]
  front: boolean
  thumbnails: Record<string, string>
  image: string
}

async function fetchCAAImages(mbid: string): Promise<CAAImage[]> {
  const res = await fetch(`${CAA_BASE}/release/${mbid}`, {
    headers: { 'User-Agent': USER_AGENT }
  })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`CAA error ${res.status} for ${mbid}`)
  const data = await res.json() as { images: CAAImage[] }
  return data.images ?? []
}

function selectBestImageUrl(image: CAAImage): string | null {
  // Prefer large thumbnails in order of quality
  const candidates = [
    image.thumbnails['1200'],
    image.thumbnails['large'],   // ~500px
    image.image,                  // original
  ].filter(Boolean)
  return candidates[0] ?? null
}

export async function fetchAlbumArtFromCAA(
  albumId: number,
  mbid: string,
  imagesDir: string
): Promise<boolean> {
  let images: CAAImage[]
  try {
    images = await fetchCAAImages(mbid)
  } catch (err) {
    console.warn(`  ⚠️  CAA fetch failed for album ${albumId}: ${(err as Error).message}`)
    return false
  }

  if (images.length === 0) {
    console.log(`  ℹ️  No CAA images for album ${albumId} (${mbid})`)
    // Record that we checked so we don't re-query on future runs
    await db
      .insertInto('images')
      .values({ album_id: albumId, is_primary: false, source: 'cover_art_archive', status: 'not_found' })
      .execute()
    return false
  }

  // Prefer 'Front' type images, fall back to any image
  const frontImages = images.filter(img => img.types?.includes('Front') || img.front)
  const best = frontImages[0] ?? images[0]
  const url = selectBestImageUrl(best)

  if (!url) return false

  // Download the image
  const ext = url.split('.').pop()?.split('?')[0] ?? 'jpg'
  const filename = `album_${albumId}_caa_${best.id}.${ext}`

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())

    const dir = path.join(imagesDir, 'albums')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, filename), buffer)

    // Set as primary if the album has no existing primary image
    const existingPrimary = await db
      .selectFrom('images')
      .select('id')
      .where('album_id', '=', albumId)
      .where('is_primary', '=', true)
      .executeTakeFirst()
    const isPrimary = !existingPrimary

    const image = await db
      .insertInto('images')
      .values({ album_id: albumId, is_primary: isPrimary, source: 'cover_art_archive', status: 'active' })
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
      await db.updateTable('albums').set({ image_path: filename, updated_at: new Date() }).where('id', '=', albumId).execute()
      console.log(`  ✅ CAA image saved and set as primary for album ${albumId}: ${filename}`)
    } else {
      console.log(`  ✅ CAA image saved for album ${albumId}: ${filename}`)
    }
    return true
  } catch (err) {
    console.warn(`  ⚠️  CAA download failed for album ${albumId}: ${(err as Error).message}`)
    return false
  }
}
