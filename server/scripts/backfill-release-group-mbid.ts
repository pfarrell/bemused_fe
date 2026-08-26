#!/usr/bin/env tsx
// server/scripts/backfill-release-group-mbid.ts
// Populates albums.release_group_musicbrainz_id for albums that already have
// a musicbrainz_id but predate the release-group column. Uses bemused's own
// local MusicBrainz mirror (musicbrainzLocal.ts) rather than the live,
// rate-limited API — unlike the older backfill-release-year.ts, which
// predates that mirror and had no faster option available at the time.
//
// Usage: tsx scripts/backfill-release-group-mbid.ts [--limit N] [--id N] [--dry-run]

import 'dotenv/config'
import { db } from '../src/db/database.js'
import { getReleaseByMbid } from '../src/services/musicbrainzLocal.js'

const args = process.argv.slice(2)
const getArg = (flag: string) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}
const hasFlag = (flag: string) => args.includes(flag)

const limit = getArg('--limit') ? parseInt(getArg('--limit')!) : undefined
const singleId = getArg('--id') ? parseInt(getArg('--id')!) : undefined
const dryRun = hasFlag('--dry-run')

if (dryRun) console.log('🔍 Dry-run mode: no writes will occur')

async function main() {
  let query = db
    .selectFrom('albums')
    .innerJoin('artists', 'artists.id', 'albums.artist_id')
    .select([
      'albums.id',
      'albums.title',
      'albums.musicbrainz_id',
      'artists.name as artist_name',
    ])
    .where('albums.musicbrainz_id', 'is not', null)
    .where('albums.release_group_musicbrainz_id', 'is', null)

  if (singleId) {
    query = query.where('albums.id', '=', singleId) as typeof query
  }
  if (limit) query = query.limit(limit) as typeof query

  const albums = await query.execute()
  console.log(`\n📀 Found ${albums.length} matched album(s) missing a release-group id`)

  let updated = 0, noGroup = 0, failed = 0

  for (const album of albums) {
    let release
    try {
      release = await getReleaseByMbid(album.musicbrainz_id!)
    } catch (err) {
      console.warn(`  ⚠️  MB lookup failed for [${album.id}] "${album.artist_name}" — "${album.title}": ${(err as Error).message}`)
      failed++
      continue
    }

    const releaseGroupId = release?.release_group_id
    if (!releaseGroupId) {
      console.log(`  ❌ No release-group on MusicBrainz: "${album.artist_name}" — "${album.title}"`)
      noGroup++
      continue
    }

    console.log(`  ✅ "${album.artist_name}" — "${album.title}": release-group ${releaseGroupId}${dryRun ? ' (dry-run, not saved)' : ''}`)
    if (!dryRun) {
      await db
        .updateTable('albums')
        .set({ release_group_musicbrainz_id: releaseGroupId, updated_at: new Date() })
        .where('id', '=', album.id)
        .execute()
    }
    updated++
  }

  console.log(`\n  Albums: ✅ ${updated} updated | ❌ ${noGroup} no MB release-group | ⚠️  ${failed} lookup failed`)
  console.log('\n✨ Done')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
