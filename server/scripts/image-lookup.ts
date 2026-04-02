#!/usr/bin/env tsx
// server/scripts/image-lookup.ts
// Usage: tsx scripts/image-lookup.ts [--limit N] [--id N] [--force] [--dry-run]

import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import { db } from '../src/db/database.js'
import { fetchAlbumArtFromCAA } from '../src/services/coverArtArchive.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const IMAGES_DIR = process.env.NODE_ENV === 'production'
  ? '/var/www/bemused-node/current/public/images'
  : path.resolve(__dirname, '../../public/images')

const args = process.argv.slice(2)
const getArg = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined }
const hasFlag = (flag: string) => args.includes(flag)

const limit = getArg('--limit') ? parseInt(getArg('--limit')!) : undefined
const singleId = getArg('--id') ? parseInt(getArg('--id')!) : undefined
const force = hasFlag('--force')
const dryRun = hasFlag('--dry-run')

if (dryRun) console.log('🔍 Dry-run mode: no writes will occur')

// 1-second rate limit between requests
let lastRequest = 0
async function rateLimit() {
  const wait = 1100 - (Date.now() - lastRequest)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastRequest = Date.now()
}

async function processAlbumImages() {
  let query = db
    .selectFrom('albums')
    .select(['id', 'title', 'musicbrainz_id'])
    .where('musicbrainz_id', 'is not', null)

  if (singleId) {
    query = query.where('id', '=', singleId) as typeof query
  } else if (!force) {
    // Skip albums that already have a cover_art_archive image
    const alreadyFetched = await db
      .selectFrom('images')
      .select('album_id')
      .where('source', '=', 'cover_art_archive')
      .where('album_id', 'is not', null)
      .execute()
    const skip = new Set(alreadyFetched.map(r => r.album_id!))
    if (skip.size > 0) {
      query = query.where('id', 'not in', [...skip]) as typeof query
    }
  }

  if (limit) query = query.limit(limit) as typeof query

  const albums = await query.execute()
  console.log(`\n📀 Fetching Cover Art Archive images for ${albums.length} albums...`)

  let fetched = 0, skipped = 0

  for (const album of albums) {
    console.log(`  Album ${album.id}: "${album.title}"`)
    if (dryRun) { console.log(`    → would fetch from CAA (dry-run)`); continue }
    await rateLimit()
    const ok = await fetchAlbumArtFromCAA(album.id, album.musicbrainz_id!, IMAGES_DIR)
    ok ? fetched++ : skipped++
  }

  if (!dryRun) console.log(`\n  Albums: ✅ ${fetched} fetched | ⚪ ${skipped} skipped`)
}

async function main() {
  try {
    await processAlbumImages()
    console.log('\n✨ Done')
    process.exit(0)
  } catch (err) {
    console.error('Fatal error:', err)
    process.exit(1)
  }
}

main()
