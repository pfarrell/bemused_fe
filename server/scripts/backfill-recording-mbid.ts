#!/usr/bin/env tsx
// server/scripts/backfill-recording-mbid.ts
// Resolves media_files.musicbrainz_recording_id via AcoustID, using the
// chromaprint_fingerprint written by backfill-chromaprint.ts. Only rows
// with a fingerprint already computed are eligible. Requires
// ACOUSTID_API_KEY in the environment.
//
// Usage: tsx scripts/backfill-recording-mbid.ts [--limit N] [--id N] [--force] [--dry-run]
//   --force re-checks rows regardless of current mbid_status (default:
//   only rows still 'unmatched', matching mbid-lookup.ts's convention).
//   No --concurrency flag: lookupRecordingMBID's internal rate limiter
//   already serializes all AcoustID calls, same as musicbrainz.ts.
//
// lookupRecordingMBID throws (not catches) if ACOUSTID_API_KEY is unset —
// a deliberate fail-loud choice for that permanent misconfiguration, so
// this script checks for the key once up front, before the loop, rather
// than discovering it via an uncaught throw on row 1 of a long batch run.

import 'dotenv/config'
import { db } from '../src/db/database.js'
import { lookupRecordingMBID } from '../src/services/acoustid.js'

if (!process.env.ACOUSTID_API_KEY) {
  console.error('❌ Error: ACOUSTID_API_KEY environment variable not set')
  process.exit(1)
}

const args = process.argv.slice(2)
const getArg = (flag: string) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}
const hasFlag = (flag: string) => args.includes(flag)

const limit = getArg('--limit') ? parseInt(getArg('--limit')!) : undefined
const singleId = getArg('--id') ? parseInt(getArg('--id')!) : undefined
const force = hasFlag('--force')
const dryRun = hasFlag('--dry-run')

if (dryRun) console.log('🔍 Dry-run mode: no writes will occur')

async function main() {
  let query = db
    .selectFrom('media_files')
    .select(['id', 'chromaprint_fingerprint', 'chromaprint_duration_sec', 'mbid_status'])
    .where('chromaprint_fingerprint', 'is not', null)

  if (singleId) {
    query = query.where('id', '=', singleId) as typeof query
  } else if (!force) {
    query = query.where('mbid_status', '=', 'unmatched') as typeof query
  }

  if (limit) query = query.limit(limit) as typeof query

  const rows = await query.execute()
  console.log(`\n🎧 Processing ${rows.length} media file(s)...`)

  let matched = 0, lowConf = 0, unmatched = 0

  for (const row of rows) {
    if (!row.chromaprint_fingerprint || row.chromaprint_duration_sec == null) continue

    if (dryRun) {
      console.log(`  [${row.id}] → would look up AcoustID (dry-run)`)
      continue
    }

    const result = await lookupRecordingMBID(row.id, row.chromaprint_fingerprint, row.chromaprint_duration_sec)

    if (result.status === 'auto_matched') {
      console.log(`  [${row.id}] ✅ Matched: ${result.mbid} (${(result.confidence * 100).toFixed(0)}%)`)
      matched++
    } else if (result.status === 'low_confidence') {
      console.log(`  [${row.id}] ⚠️  Low confidence: ${result.mbid} (${(result.confidence * 100).toFixed(0)}%)`)
      lowConf++
    } else {
      console.log(`  [${row.id}] ❌ No match`)
      unmatched++
    }
  }

  if (!dryRun) {
    console.log(`\n  Media files: ✅ ${matched} matched | ⚠️  ${lowConf} low-confidence | ❌ ${unmatched} unmatched`)
  }
  console.log('\n✨ Done')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
