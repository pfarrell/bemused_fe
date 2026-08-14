#!/usr/bin/env tsx
// server/scripts/backfill-media-hashes.ts
// Computes and stores file_hash for media_files rows that are referenced
// by a track but have never been hashed — the prerequisite for detecting
// duplicate content at all. Found by joining through tracks.media_file_id
// (the real, live relationship) rather than filtering on
// media_files.entity_type, since a large majority of the real library
// still carries the older entity_type='track' convention rather than the
// newer entity_type IS NULL one — see docs/superpowers/specs/2026-08-14-
// media-file-hash-backfill-design.md for why that distinction matters
// (it's exactly the bug already found and fixed once in queue-handler.ts).
//
// Usage: tsx scripts/backfill-media-hashes.ts [--limit N] [--id N] [--dry-run]

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
const dryRun = hasFlag('--dry-run')

if (dryRun) console.log('🔍 Dry-run mode: no writes will occur')

async function main() {
  let query = db
    .selectFrom('media_files')
    .innerJoin('tracks', 'tracks.media_file_id', 'media_files.id')
    .select([
      'media_files.id',
      'media_files.absolute_path',
      'media_files.name',
    ])
    .where('media_files.file_hash', 'is', null)
    .distinct()

  if (singleId) {
    query = query.where('media_files.id', '=', singleId) as typeof query
  }
  if (limit) query = query.limit(limit) as typeof query

  const rows = await query.execute()
  console.log(`\n🎵 Found ${rows.length} media_files row(s) needing a hash`)

  let hashed = 0, missing = 0, failed = 0

  for (const row of rows) {
    if (!row.absolute_path || !fs.existsSync(row.absolute_path)) {
      console.log(`  ⚠️  [${row.id}] file missing on disk: ${row.absolute_path ?? '(no path recorded)'}`)
      missing++
      if (!dryRun) {
        await db
          .updateTable('media_files')
          .set({ file_missing: true, updated_at: new Date() })
          .where('id', '=', row.id)
          .execute()
      }
      continue
    }

    try {
      const hash = await calculateFileHash(row.absolute_path)
      console.log(`  ✅ [${row.id}] ${row.name ?? row.absolute_path}: ${hash}${dryRun ? ' (dry-run, not saved)' : ''}`)
      if (!dryRun) {
        await db
          .updateTable('media_files')
          .set({ file_hash: hash, updated_at: new Date() })
          .where('id', '=', row.id)
          .execute()
      }
      hashed++
    } catch (err) {
      console.warn(`  ❌ [${row.id}] failed to read/hash: ${(err as Error).message}`)
      failed++
    }
  }

  console.log(`\n  Media files: ✅ ${hashed} hashed | ⚠️  ${missing} missing on disk | ❌ ${failed} read failed`)
  console.log('\n✨ Done')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
