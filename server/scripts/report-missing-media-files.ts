#!/usr/bin/env tsx
// server/scripts/report-missing-media-files.ts
// Reports every AUDIO media_files row whose absolute_path does not exist
// on disk. Read-only — makes no database writes and deletes nothing, so
// results can be researched (files may have moved across the several
// past location changes, not necessarily vanished) before any cleanup
// decision is made. Covers ALL audio media_files rows, including ones
// with no track pointing at them (unlike backfill-file-hash.ts /
// backfill-chromaprint.ts, which only touch actively-referenced files)
// — this is deliberately broader so nothing orphaned is missed.
//
// Scoped to entity_type IS NULL OR entity_type = 'track' — the same
// audio-row allowlist convention used by queue-handler.ts's media-file
// dedup match and backfill-file-hash.ts. media_files also holds
// entity_type = 'image' rows (cached artist/album art from
// fanart.ts/coverArtArchive.ts), whose absolute_path is stored as a bare
// filename resolved against public/images/, not a real absolute path —
// running fs.existsSync directly on those would report nearly all of
// them "missing" regardless of whether the image actually exists,
// which is a different bug class entirely and out of scope for audio
// duplicate/orphan research.
//
// Usage: tsx scripts/report-missing-media-files.ts [--log path]
//
// Output: tab-separated lines prefixed "MISSING" or "UNREADABLE" written
// to both stdout and the log file:
//   MISSING\t<id>\t<absolute_path>\t<name>\t<imported_date>\t<last_modified>\t<has_track>\t<track_id>\t<track_title>\t<artist_name>
//   UNREADABLE\t<id>\t<absolute_path>\t<error_code>\t...(same remaining columns)
// UNREADABLE means the path exists but couldn't be stat'd (e.g.
// permission denied, or an unmounted NAS returning EACCES/EIO rather
// than ENOENT) — that's a different problem from "genuinely absent" and
// must not be silently folded into the MISSING count.
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

type PathCheck = { status: 'exists' } | { status: 'missing' } | { status: 'unreadable'; code: string }

function checkPath(absolutePath: string | null): PathCheck {
  if (!absolutePath) return { status: 'missing' }
  try {
    fs.statSync(absolutePath)
    return { status: 'exists' }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? 'UNKNOWN'
    if (code === 'ENOENT') return { status: 'missing' }
    return { status: 'unreadable', code }
  }
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
    .where(eb => eb.or([eb('media_files.entity_type', 'is', null), eb('media_files.entity_type', '=', 'track')]))
    .orderBy('media_files.id')
    .execute()

  logLine(`\n🔍 Scanning ${rows.length} audio media_files row(s) for missing files on disk`)

  let missing = 0
  let missingWithTrack = 0
  let missingOrphaned = 0
  let unreadable = 0

  for (const row of rows) {
    const check = checkPath(row.absolute_path)
    if (check.status === 'exists') continue

    const hasTrack = row.track_id != null
    const commonFields = [
      row.id,
      row.absolute_path ?? '',
      row.name ?? '',
      row.imported_date ? new Date(row.imported_date).toISOString() : '',
      row.last_modified ? new Date(row.last_modified).toISOString() : '',
      hasTrack ? 'yes' : 'no',
      row.track_id ?? '',
      row.track_title ?? '',
      row.artist_name ?? '',
    ]

    if (check.status === 'unreadable') {
      unreadable++
      logLine(['UNREADABLE', commonFields[0], commonFields[1], check.code, ...commonFields.slice(2)].join('\t'))
      continue
    }

    missing++
    if (hasTrack) missingWithTrack++
    else missingOrphaned++
    logLine(['MISSING', ...commonFields].join('\t'))
  }

  logLine(
    `\n  Scanned: ${rows.length} | Missing: ${missing} ` +
    `(⚠️  ${missingWithTrack} still linked to a track, ${missingOrphaned} orphaned with no track) | ` +
    `Unreadable: ${unreadable} | On disk: ${rows.length - missing - unreadable}`
  )
  logLine('✨ Done')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
