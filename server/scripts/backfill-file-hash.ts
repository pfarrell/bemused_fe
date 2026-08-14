#!/usr/bin/env tsx
// server/scripts/backfill-file-hash.ts
// Computes and stores media_files.file_hash for actively-referenced files
// (those with a track pointing to them) that don't have one yet. Matches the
// "active" definition used by the upload-dedup check in routes/upload.ts —
// legacy media_files with no track pointing at them are intentionally left
// alone, same as that check ignores them.
//
// Usage: tsx scripts/backfill-file-hash.ts [--limit N] [--id N] [--dry-run] [--concurrency N] [--log path] [--checkpoint N]
//
// Progress checkpoints (every --checkpoint files, default 100) are written
// to both stdout and the log file, so `tail -f` on the log gives live status
// during a long unattended run.

import 'dotenv/config'
import fs from 'fs'
import { db } from '../src/db/database.js'
import { calculateFileHash } from '../src/utils/fileHash.js'

const args = process.argv.slice(2)
const getArg = (flag: string) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}
const hasFlag = (flag: string) => args.includes(flag)

const limit = getArg('--limit') ? parseInt(getArg('--limit')!) : undefined
const singleId = getArg('--id') ? parseInt(getArg('--id')!) : undefined
const concurrency = getArg('--concurrency') ? parseInt(getArg('--concurrency')!) : 8
const dryRun = hasFlag('--dry-run')
const checkpointEvery = getArg('--checkpoint') ? parseInt(getArg('--checkpoint')!) : 100
const logPath = getArg('--log') || 'backfill-file-hash.log'

if (dryRun) console.log('🔍 Dry-run mode: no writes will occur')
console.log(`📝 Progress log: ${logPath} (checkpoint every ${checkpointEvery} files)`)

function logLine(msg: string) {
  console.log(msg)
  fs.appendFileSync(logPath, msg + '\n')
}

type FileRow = { id: number; absolute_path: string | null; track_id: number; track_title: string }
type Result =
  | { status: 'hashed' }
  | { status: 'missing' }
  | { status: 'error'; message: string }

async function processFile(file: FileRow): Promise<Result> {
  if (!file.absolute_path || !fs.existsSync(file.absolute_path)) {
    if (!dryRun) {
      await db
        .updateTable('media_files')
        .set({ file_missing: true, updated_at: new Date() })
        .where('id', '=', file.id)
        .execute()
    }
    return { status: 'missing' }
  }

  let hash: string
  try {
    hash = await calculateFileHash(file.absolute_path)
  } catch (err) {
    return { status: 'error', message: (err as Error).message }
  }

  if (!dryRun) {
    await db
      .updateTable('media_files')
      .set({ file_hash: hash, file_missing: false, updated_at: new Date() })
      .where('id', '=', file.id)
      .execute()
  }
  return { status: 'hashed' }
}

async function main() {
  let query = db
    .selectFrom('media_files')
    .innerJoin('tracks', 'tracks.media_file_id', 'media_files.id')
    .select(['media_files.id', 'media_files.absolute_path', 'tracks.id as track_id', 'tracks.title as track_title'])
    .where('media_files.file_hash', 'is', null)
    .orderBy('media_files.id')

  if (singleId) query = query.where('media_files.id', '=', singleId) as typeof query
  if (limit) query = query.limit(limit) as typeof query

  const files = (await query.execute()) as FileRow[]
  const startMsg = `\n🎵 Found ${files.length} active media file(s) missing a hash`
  console.log(startMsg)
  fs.appendFileSync(logPath, startMsg + '\n')

  let hashed = 0
  let missing = 0
  let failed = 0
  let processed = 0
  let nextIndex = 0

  async function worker() {
    while (nextIndex < files.length) {
      const file = files[nextIndex++]
      const result = await processFile(file)
      processed++

      if (result.status === 'hashed') {
        hashed++
      } else if (result.status === 'missing') {
        missing++
        console.warn(`  [${processed}/${files.length}] ⚠️  File not found: ${file.absolute_path}`)
      } else {
        failed++
        console.error(`  [${processed}/${files.length}] ❌ [${file.id}] ${file.absolute_path}: ${result.message}`)
      }

      if (processed % checkpointEvery === 0) {
        const remaining = files.length - processed
        logLine(
          `  [${processed}/${files.length}] checkpoint — last: track ${file.track_id} "${file.track_title}" (${result.status}) | ` +
          `completed=${processed} remaining=${remaining} | ✅${hashed} ⚠️${missing} ❌${failed}`
        )
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) || 1 }, worker))

  logLine(`\n  Files: ✅ ${hashed} hashed | ⚠️  ${missing} missing on disk | ❌ ${failed} read errors`)
  logLine('✨ Done')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
