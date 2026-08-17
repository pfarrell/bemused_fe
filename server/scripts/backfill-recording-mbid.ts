#!/usr/bin/env tsx
// server/scripts/backfill-recording-mbid.ts
// Resolves media_files.musicbrainz_recording_id via AcoustID, using the
// chromaprint_fingerprint written by backfill-chromaprint.ts. Only rows
// with a fingerprint already computed are eligible. Requires
// ACOUSTID_API_KEY in the environment.
//
// Usage: tsx scripts/backfill-recording-mbid.ts [--limit N] [--id N] [--ids-file path] [--force] [--dry-run] [--log path] [--checkpoint N]
//   --force re-checks rows regardless of current mbid_status (default:
//   only rows still 'unmatched', matching mbid-lookup.ts's convention).
//   --ids-file re-checks exactly the media_file ids listed (one per line,
//   blank lines and lines starting with # ignored) regardless of their
//   current mbid_status — this is how you re-run just the rows flagged by
//   audit-recording-mbid-collisions.sql instead of paying AcoustID's ~3
//   req/s rate limit across the whole library. Overrides --id/--force.
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
import { sql } from 'kysely'
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
const idsFilePath = getArg('--ids-file')
const force = hasFlag('--force')
const dryRun = hasFlag('--dry-run')
const checkpointEvery = getArg('--checkpoint') ? parseInt(getArg('--checkpoint')!) : 100
const logPath = getArg('--log') || 'backfill-recording-mbid.log'

const idsFromFile: number[] | undefined = idsFilePath
  ? fs.readFileSync(idsFilePath, 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const id = parseInt(line)
        if (Number.isNaN(id)) throw new Error(`--ids-file: not a valid id: "${line}"`)
        return id
      })
  : undefined

if (idsFromFile && idsFromFile.length === 0) {
  console.error(`❌ Error: --ids-file ${idsFilePath} contained no ids`)
  process.exit(1)
}

if (dryRun) console.log('🔍 Dry-run mode: no writes will occur')
console.log(`📝 Progress log: ${logPath} (checkpoint every ${checkpointEvery} rows)`)

function logLine(msg: string) {
  console.log(msg)
  fs.appendFileSync(logPath, msg + '\n')
}

async function main() {
  let query = db
    .selectFrom('media_files')
    .select(['media_files.id', 'media_files.chromaprint_fingerprint', 'media_files.chromaprint_duration_sec', 'media_files.mbid_status'])
    .where('chromaprint_fingerprint', 'is not', null)

  if (idsFromFile) {
    // NOT .where('id', 'in', idsFromFile) — Kysely expands an `in` array
    // into one bind parameter per element. At the ~15k rows a suspicious-
    // group audit can produce, that's 15k+ discrete placeholders, and
    // Postgres's planner chokes badly on parsing/planning that many
    // parameters (minutes, possibly much longer, with the query never
    // completing in practice). A single array parameter bound to ANY()
    // is one placeholder regardless of list size and stays fast.
    query = query.where(sql<boolean>`media_files.id = any(${idsFromFile})`) as typeof query
  } else if (singleId) {
    query = query.where('id', '=', singleId) as typeof query
  } else if (!force) {
    query = query.where('mbid_status', '=', 'unmatched') as typeof query
  }

  if (limit) query = query.limit(limit) as typeof query

  const rows = await query.execute()

  // Fetched separately rather than as a per-row correlated subquery:
  // tracks.media_file_id has no index (only the bare FK constraint), so a
  // subquery run once per candidate row means one full sequential scan of
  // `tracks` (141k+ rows) per row — for a batch of any real size that
  // never finishes in practice. One bulk lookup means exactly one scan of
  // `tracks` regardless of batch size.
  const mediaFileIds = rows.map(r => r.id)
  const trackTitleRows = mediaFileIds.length > 0
    ? await db
        .selectFrom('tracks')
        .select(['media_file_id', 'title'])
        .where(sql<boolean>`tracks.media_file_id = any(${mediaFileIds})`)
        .execute()
    : []
  const titleByMediaFileId = new Map<number, string>()
  for (const t of trackTitleRows) {
    // A media_file can back more than one track (same recording shared
    // across releases) — any one of their titles is fine for the
    // cross-check, they should all describe the same recording.
    if (t.media_file_id != null && !titleByMediaFileId.has(t.media_file_id)) {
      titleByMediaFileId.set(t.media_file_id, t.title)
    }
  }

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
      const result = await lookupRecordingMBID(row.id, row.chromaprint_fingerprint, row.chromaprint_duration_sec, titleByMediaFileId.get(row.id))

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
