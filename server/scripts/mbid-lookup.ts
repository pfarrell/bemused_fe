#!/usr/bin/env tsx
// server/scripts/mbid-lookup.ts
// Usage: tsx scripts/mbid-lookup.ts [--type albums|artists|both] [--limit N] [--id N] [--force] [--dry-run]

import 'dotenv/config'
import { db } from '../src/db/database.js'
import { lookupAlbumMBID, lookupArtistMBID } from '../src/services/musicbrainz.js'

const args = process.argv.slice(2)
const getArg = (flag: string) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}
const hasFlag = (flag: string) => args.includes(flag)

const type = getArg('--type') ?? 'both'
const limit = getArg('--limit') ? parseInt(getArg('--limit')!) : undefined
const singleId = getArg('--id') ? parseInt(getArg('--id')!) : undefined
const force = hasFlag('--force')
const dryRun = hasFlag('--dry-run')

if (dryRun) console.log('🔍 Dry-run mode: no writes will occur')

async function processAlbums() {
  let query = db
    .selectFrom('albums')
    .innerJoin('artists', 'artists.id', 'albums.artist_id')
    .select([
      'albums.id',
      'albums.title',
      'albums.release_year',
      'albums.mbid_status',
      'artists.name as artist_name',
    ])

  if (singleId) {
    query = query.where('albums.id', '=', singleId) as typeof query
  } else if (!force) {
    query = query.where('albums.mbid_status', '=', 'unmatched') as typeof query
  }

  if (limit) query = query.limit(limit) as typeof query

  const albums = await query.execute()
  console.log(`\n📀 Processing ${albums.length} albums...`)

  let matched = 0, lowConf = 0, unmatched = 0

  for (const album of albums) {
    // Get track count for this album
    const trackResult = await db
      .selectFrom('tracks')
      .select(db.fn.count<number>('id').as('count'))
      .where('album_id', '=', album.id)
      .executeTakeFirst()
    const trackCount = Number(trackResult?.count ?? 0)

    console.log(`  Checking: "${album.artist_name}" — "${album.title}"`)

    if (dryRun) {
      console.log(`    → would search MB (dry-run)`)
      continue
    }

    const result = await lookupAlbumMBID(
      album.id,
      album.title,
      album.artist_name,
      trackCount,
      album.release_year
    )

    if (result.status === 'auto_matched') {
      console.log(`    ✅ Matched: ${result.mbid} (confidence: ${(result.confidence * 100).toFixed(0)}%)`)
      matched++
    } else if (result.status === 'low_confidence') {
      console.log(`    ⚠️  Low confidence: ${result.mbid} (${(result.confidence * 100).toFixed(0)}%)`)
      lowConf++
    } else {
      console.log(`    ❌ No match`)
      unmatched++
    }
  }

  if (!dryRun) {
    console.log(`\n  Albums: ✅ ${matched} matched | ⚠️  ${lowConf} low-confidence | ❌ ${unmatched} unmatched`)
  }
}

async function processArtists() {
  let query = db
    .selectFrom('artists')
    .select(['id', 'name', 'mbid_status'])

  if (singleId) {
    query = query.where('id', '=', singleId) as typeof query
  } else if (!force) {
    query = query.where('mbid_status', '=', 'unmatched') as typeof query
  }

  if (limit) query = query.limit(limit) as typeof query

  const artists = await query.execute()
  console.log(`\n🎤 Processing ${artists.length} artists...`)

  let matched = 0, lowConf = 0, unmatched = 0

  for (const artist of artists) {
    console.log(`  Checking: "${artist.name}"`)

    if (dryRun) {
      console.log(`    → would search MB (dry-run)`)
      continue
    }

    const result = await lookupArtistMBID(artist.id, artist.name)

    if (result.status === 'auto_matched') {
      console.log(`    ✅ Matched: ${result.mbid} (confidence: ${(result.confidence * 100).toFixed(0)}%)`)
      matched++
    } else if (result.status === 'low_confidence') {
      console.log(`    ⚠️  Low confidence: ${result.mbid} (${(result.confidence * 100).toFixed(0)}%)`)
      lowConf++
    } else {
      console.log(`    ❌ No match`)
      unmatched++
    }
  }

  if (!dryRun) {
    console.log(`\n  Artists: ✅ ${matched} matched | ⚠️  ${lowConf} low-confidence | ❌ ${unmatched} unmatched`)
  }
}

async function main() {
  try {
    if (type === 'albums' || type === 'both') await processAlbums()
    if (type === 'artists' || type === 'both') await processArtists()
    console.log('\n✨ Done')
    process.exit(0)
  } catch (err) {
    console.error('Fatal error:', err)
    process.exit(1)
  }
}

main()
