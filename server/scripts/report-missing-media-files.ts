#!/usr/bin/env tsx
// server/scripts/report-missing-media-files.ts
// Reports every media_files row whose absolute_path does not exist on
// disk. Read-only — makes no database writes and deletes nothing, so
// results can be researched (files may have moved across the several
// past location changes, not necessarily vanished) before any cleanup
// decision is made. Covers ALL media_files rows, including ones with no
// track pointing at them (unlike backfill-file-hash.ts / backfill-chromaprint.ts,
// which only touch actively-referenced files) — this is deliberately
// broader so nothing orphaned is missed.
//
// Usage: tsx scripts/report-missing-media-files.ts [--log path]
//
// Output: tab-separated lines prefixed "MISSING" written to both stdout
// and the log file:
//   MISSING\t<id>\t<absolute_path>\t<name>\t<imported_date>\t<last_modified>\t<has_track>\t<track_id>\t<track_title>\t<artist_name>
// e.g. `grep '^MISSING' out.log | cut -f2` for just the paths.

import 'dotenv/config'
import fs from 'fs'
import { db } from '../src/db/database.js'

const args = process.argv.slice(2)
const getArg = (flag: string) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}
const logPath = getArg('--log') || 'report-missing-media-files.log'

function logLine(msg: string) {
  console.log(msg)
  fs.appendFileSync(logPath, msg + '\n')
}

async function main() {
  const rows = await db
    .selectFrom('media_files')
    .leftJoin('tracks', 'tracks.media_file_id', 'media_files.id')
    .leftJoin('artists', 'artists.id', 'tracks.artist_id')
    .select([
      'media_files.id',
      'media_files.absolute_path',
      'media_files.name',
      'media_files.imported_date',
      'media_files.last_modified',
      'tracks.id as track_id',
      'tracks.title as track_title',
      'artists.name as artist_name',
    ])
    .orderBy('media_files.id')
    .execute()

  logLine(`\n🔍 Scanning ${rows.length} media_files row(s) for missing files on disk`)

  let missing = 0
  let missingWithTrack = 0
  let missingOrphaned = 0

  for (const row of rows) {
    const exists = row.absolute_path ? fs.existsSync(row.absolute_path) : false
    if (exists) continue

    missing++
    const hasTrack = row.track_id != null
    if (hasTrack) missingWithTrack++
    else missingOrphaned++

    logLine(
      [
        'MISSING',
        row.id,
        row.absolute_path ?? '',
        row.name ?? '',
        row.imported_date ? new Date(row.imported_date).toISOString() : '',
        row.last_modified ? new Date(row.last_modified).toISOString() : '',
        hasTrack ? 'yes' : 'no',
        row.track_id ?? '',
        row.track_title ?? '',
        row.artist_name ?? '',
      ].join('\t')
    )
  }

  logLine(
    `\n  Scanned: ${rows.length} | Missing: ${missing} ` +
    `(⚠️  ${missingWithTrack} still linked to a track, ${missingOrphaned} orphaned with no track) | ` +
    `On disk: ${rows.length - missing}`
  )
  logLine('✨ Done')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
