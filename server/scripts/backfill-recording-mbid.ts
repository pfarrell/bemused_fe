#!/usr/bin/env tsx
// server/scripts/backfill-recording-mbid.ts
// Resolves media_files.musicbrainz_recording_id via AcoustID, using the
// chromaprint_fingerprint written by backfill-chromaprint.ts. Only rows
// with a fingerprint already computed are eligible. Requires
// ACOUSTID_API_KEY in the environment.
//
// Usage: tsx scripts/backfill-recording-mbid.ts [--limit N] [--id N] [--force] [--dry-run] [--log path] [--checkpoint N]
//   --force re-checks rows regardless of current mbid_status (default:
//   only rows still 'unmatched', matching mbid-lookup.ts's convention).
//   No --concurrency flag: lookupRecordingMBID's internal rate limiter
//   already serializes all AcoustID calls, same as musicbrainz.ts.
//
// Progress checkpoints (every --checkpoint rows, default 100) are written
// to both stdout and the log file, so `tail -f` on the log gives live
// status during a long unattended run — at AcoustID's ~3 req/s ceiling,
// a full-library run is measured in hours, so relying on a tmux pane's
// scrollback alone risks losing the human-readable progress trail if it
// gets truncated (the DB writes themselves are unaffected either way).
//
// lookupRecordingMBID throws (not catches) if ACOUSTID_API_KEY is unset —
// a deliberate fail-loud choice for that permanent misconfiguration, so
// this script checks for the key once up front, before the loop, rather
// than discovering it via an uncaught throw on row 1 of a long batch run.

import 'dotenv/config'
import fs from 'fs'
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
const checkpointEvery = getArg('--checkpoint') ? parseInt(getArg('--checkpoint')!) : 100
const logPath = getArg('--log') || 'backfill-recording-mbid.log'

if (dryRun) console.log('🔍 Dry-run mode: no writes will occur')
console.log(`📝 Progress log: ${logPath} (checkpoint every ${checkpointEvery} rows)`)

function logLine(msg: string) {
  console.log(msg)
  fs.appendFileSync(logPath, msg + '\n')
}

async function main() {
  let query = db
    .selectFrom('media_files')
    .select(eb => [
      'media_files.id',
      'media_files.chromaprint_fingerprint',
      'media_files.chromaprint_duration_sec',
      'media_files.mbid_status',
      // A media_file can back more than one track (same recording shared
      // across releases) — any one of their titles is fine for the
      // cross-check, they should all describe the same recording.
      eb.selectFrom('tracks')
        .select('tracks.title')
        .whereRef('tracks.media_file_id', '=', 'media_files.id')
        .limit(1)
        .as('track_title'),
    ])
    .where('chromaprint_fingerprint', 'is not', null)

  if (singleId) {
    query = query.where('id', '=', singleId) as typeof query
  } else if (!force) {
    query = query.where('mbid_status', '=', 'unmatched') as typeof query
  }

  if (limit) query = query.limit(limit) as typeof query

  const rows = await query.execute()
  logLine(`\n🎧 Processing ${rows.length} media file(s)...`)

  let matched = 0, lowConf = 0, unmatched = 0, skipped = 0, processed = 0

  for (const row of rows) {
    // processed is incremented unconditionally, before any branch —
    // checkpoint accounting must fire on the skip-path too, not just the
    // normal fall-through (this exact class of bug has bitten a sibling
    // script in this codebase before).
    processed++

    if (!row.chromaprint_fingerprint || row.chromaprint_duration_sec == null) {
      skipped++
    } else if (dryRun) {
      console.log(`  [${row.id}] → would look up AcoustID (dry-run)`)
    } else {
      const result = await lookupRecordingMBID(row.id, row.chromaprint_fingerprint, row.chromaprint_duration_sec, row.track_title ?? undefined)

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

    if (processed % checkpointEvery === 0) {
      const remaining = rows.length - processed
      logLine(
        `  [${processed}/${rows.length}] checkpoint — completed=${processed} remaining=${remaining} | ` +
        `✅${matched} ⚠️${lowConf} ❌${unmatched}${skipped ? ` (skipped ${skipped})` : ''}`
      )
    }
  }

  if (!dryRun) {
    logLine(
      `\n  Media files: ✅ ${matched} matched | ⚠️  ${lowConf} low-confidence | ❌ ${unmatched} unmatched` +
      (skipped ? ` | ⏭️  ${skipped} skipped (no fingerprint/duration)` : '')
    )
  }
  logLine('\n✨ Done')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
