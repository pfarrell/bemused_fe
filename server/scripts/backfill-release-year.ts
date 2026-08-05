#!/usr/bin/env tsx
// server/scripts/backfill-release-year.ts
// Populates albums.release_year from MusicBrainz for albums that have a
// musicbrainz_id. Prefers the release-group's first-release-date (the
// original work's year, e.g. 1969 for a Beatles album) over the specific
// release's own date, so remasters/reissues/live-album repackagings don't
// get sorted or displayed under the year of that particular edition.
//
// Usage: tsx scripts/backfill-release-year.ts [--limit N] [--id N] [--dry-run] [--all]
//   --all   re-check every album with a musicbrainz_id, not just ones
//           missing a release_year — use this to correct years that were
//           previously populated from a specific release's date.

import 'dotenv/config'
import { db } from '../src/db/database.js'
import { getReleaseByMbid } from '../src/services/musicbrainz.js'

const args = process.argv.slice(2)
const getArg = (flag: string) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}
const hasFlag = (flag: string) => args.includes(flag)

const limit = getArg('--limit') ? parseInt(getArg('--limit')!) : undefined
const singleId = getArg('--id') ? parseInt(getArg('--id')!) : undefined
const dryRun = hasFlag('--dry-run')
const all = hasFlag('--all')

if (dryRun) console.log('🔍 Dry-run mode: no writes will occur')

async function main() {
  let query = db
    .selectFrom('albums')
    .innerJoin('artists', 'artists.id', 'albums.artist_id')
    .select([
      'albums.id',
      'albums.title',
      'albums.release_year',
      'albums.musicbrainz_id',
      'artists.name as artist_name',
    ])
    .where('albums.musicbrainz_id', 'is not', null)
    .where('albums.title', '!=', '_Singles')

  if (!all) {
    query = query.where(eb => eb.or([
      eb('albums.release_year', 'is', null),
      eb('albums.release_year', '=', ''),
      eb('albums.release_year', '=', '0'),
    ])) as typeof query
  }

  if (singleId) {
    query = query.where('albums.id', '=', singleId) as typeof query
  }
  if (limit) query = query.limit(limit) as typeof query

  const albums = await query.execute()
  console.log(`\n📀 Found ${albums.length} albums to check`)

  let updated = 0, unchanged = 0, noDate = 0, failed = 0

  for (const album of albums) {
    let release
    try {
      release = await getReleaseByMbid(album.musicbrainz_id!)
    } catch (err) {
      console.warn(`  ⚠️  MB lookup failed for "${album.artist_name}" — "${album.title}": ${(err as Error).message}`)
      failed++
      continue
    }

    const year = (release?.original_date || release?.date)?.match(/^\d{4}/)?.[0]
    if (!year) {
      console.log(`  ❌ No release date on MusicBrainz: "${album.artist_name}" — "${album.title}"`)
      noDate++
      continue
    }

    if (year === album.release_year) {
      unchanged++
      continue
    }

    console.log(`  ✅ "${album.artist_name}" — "${album.title}": ${album.release_year ?? '(none)'} → ${year}${dryRun ? ' (dry-run, not saved)' : ''}`)
    if (!dryRun) {
      await db
        .updateTable('albums')
        .set({ release_year: year, updated_at: new Date() })
        .where('id', '=', album.id)
        .execute()
    }
    updated++
  }

  console.log(`\n  Albums: ✅ ${updated} updated | ➖ ${unchanged} unchanged | ❌ ${noDate} no MB date | ⚠️  ${failed} lookup failed`)
  console.log('\n✨ Done')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
