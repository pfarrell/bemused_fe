#!/usr/bin/env tsx
// server/scripts/backfill-chromaprint.ts
// Computes and stores media_files.chromaprint_fingerprint /
// chromaprint_duration_sec for actively-referenced files (those with a
// track pointing to them) that don't have one yet. Same "active"
// definition as backfill-file-hash.ts — legacy media_files with no track
// pointing at them are intentionally left alone (see report-missing-media-files.ts
// for a script that covers those too).
//
// Usage: tsx scripts/backfill-chromaprint.ts [--limit N] [--id N] [--dry-run] [--concurrency N] [--log path] [--checkpoint N]

import 'dotenv/config'
import fs from 'fs'
import { db } from '../src/db/database.js'
import { computeFingerprint } from '../src/utils/chromaprint.js'

const args = process.argv.slice(2)
const getArg = (flag: string) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}
const hasFlag = (flag: string) => args.includes(flag)

const limit = getArg('--limit') ? parseInt(getArg('--limit')!) : undefined
const singleId = getArg('--id') ? parseInt(getArg('--id')!) : undefined
const concurrency = getArg('--concurrency') ? parseInt(getArg('--concurrency')!) : 4
const dryRun = hasFlag('--dry-run')
const checkpointEvery = getArg('--checkpoint') ? parseInt(getArg('--checkpoint')!) : 100
const logPath = getArg('--log') || 'backfill-chromaprint.log'

if (dryRun) console.log('🔍 Dry-run mode: no writes will occur')
console.log(`📝 Progress log: ${logPath} (checkpoint every ${checkpointEvery} files)`)

function logLine(msg: string) {
  console.log(msg)
  fs.appendFileSync(logPath, msg + '\n')
}

type FileRow = { id: number; absolute_path: string | null; track_id: number; track_title: string }
type Result =
  | { status: 'fingerprinted' }
  | { status: 'missing' }
  | { status: 'error'; message: string }

async function processFile(file: FileRow): Promise<Result> {
  if (!file.absolute_path || !fs.existsSync(file.absolute_path)) {
    return { status: 'missing' }
  }

  let fp: { duration: number; fingerprint: string }
  try {
    fp = await computeFingerprint(file.absolute_path)
  } catch (err) {
    return { status: 'error', message: (err as Error).message }
  }

  if (!dryRun) {
    await db
      .updateTable('media_files')
      .set({
        chromaprint_fingerprint: fp.fingerprint,
        chromaprint_duration_sec: Math.round(fp.duration),
        updated_at: new Date(),
      })
      .where('id', '=', file.id)
      .execute()
  }
  return { status: 'fingerprinted' }
}

async function main() {
  let query = db
    .selectFrom('media_files')
    .innerJoin('tracks', 'tracks.media_file_id', 'media_files.id')
    .select(['media_files.id', 'media_files.absolute_path', 'tracks.id as track_id', 'tracks.title as track_title'])
    .where('media_files.chromaprint_fingerprint', 'is', null)
    .where('media_files.file_missing', 'is not', true)
    .orderBy('media_files.id')

  if (singleId) query = query.where('media_files.id', '=', singleId) as typeof query
  if (limit) query = query.limit(limit) as typeof query

  const files = (await query.execute()) as FileRow[]
  const startMsg = `\n🎵 Found ${files.length} active media file(s) missing a fingerprint`
  console.log(startMsg)
  fs.appendFileSync(logPath, startMsg + '\n')

  let fingerprinted = 0
  let missing = 0
  let failed = 0
  let processed = 0
  let nextIndex = 0

  async function worker() {
    while (nextIndex < files.length) {
      const file = files[nextIndex++]
      const result = await processFile(file)
      processed++

      if (result.status === 'fingerprinted') {
        fingerprinted++
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
          `completed=${processed} remaining=${remaining} | ✅${fingerprinted} ⚠️${missing} ❌${failed}`
        )
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) || 1 }, worker))

  logLine(`\n  Files: ✅ ${fingerprinted} fingerprinted | ⚠️  ${missing} missing on disk | ❌ ${failed} errors`)
  logLine('✨ Done')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
