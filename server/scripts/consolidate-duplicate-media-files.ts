#!/usr/bin/env tsx
// server/scripts/consolidate-duplicate-media-files.ts
// Finds media_files rows with duplicate file_hash values — found by
// joining through tracks.media_file_id, not by filtering on entity_type
// (see backfill-file-hash.ts's header comment) — picks the oldest
// verified-existing-on-disk row per group as canonical, repoints every
// other track in the group to it, and deletes the now-unreferenced
// redundant media_files rows. Tracks are never merged: each keeps its own
// title/artist/approval-state/notes, only media_file_id changes.
//
// Physical files are NEVER deleted by this script. It prints a report of
// every file that's now safe to delete manually — lines prefixed
// "DELETABLE\t<path>\t<bytes>" so they're easy to grep out
// (e.g. `grep '^DELETABLE' out.txt | cut -f2 > to-delete.txt`).
//
// Usage: tsx scripts/consolidate-duplicate-media-files.ts [--apply] [--limit N]
//   Default is dry-run (reports what would happen, writes nothing).
//   --apply is required for any database write — omitting --dry-run alone
//   is not enough, given the scale of what this touches.

import 'dotenv/config'
import fs from 'fs'
import { db } from '../src/db/database.js'

const args = process.argv.slice(2)
const getArg = (flag: string) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}
const hasFlag = (flag: string) => args.includes(flag)

const limit = getArg('--limit') ? parseInt(getArg('--limit')!) : undefined
const apply = hasFlag('--apply')

console.log(apply
  ? '⚠️  APPLY mode: database will be modified'
  : '🔍 Dry-run mode: no writes will occur (pass --apply to modify the database)')

interface DeletableFile {
  mediaFileId: number
  absolutePath: string
  sizeBytes: number
}

async function main() {
  const groupCounts = await db
    .selectFrom('media_files')
    .innerJoin('tracks', 'tracks.media_file_id', 'media_files.id')
    .select(['media_files.file_hash', db.fn.count<number>('tracks.id').as('trackCount')])
    .where('media_files.file_hash', 'is not', null)
    .groupBy('media_files.file_hash')
    .execute()

  const hashes = groupCounts
    .filter(g => Number(g.trackCount) > 1)
    .map(g => g.file_hash!)
    .slice(0, limit)

  console.log(`\n🔁 Found ${groupCounts.filter(g => Number(g.trackCount) > 1).length} duplicate-hash group(s)${limit ? `, processing first ${hashes.length}` : ''}`)

  let groupsConsolidated = 0, groupsSkipped = 0, tracksRepointed = 0, rowsDeleted = 0
  const deletable: DeletableFile[] = []

  for (const hash of hashes) {
    const candidates = await db
      .selectFrom('media_files')
      .selectAll()
      .where('file_hash', '=', hash)
      .execute()

    const existing = candidates.filter(c => c.absolute_path && fs.existsSync(c.absolute_path))

    if (existing.length === 0) {
      console.log(`  ⚠️  [hash ${hash}] no candidate row's file exists on disk — skipping group (${candidates.length} row(s))`)
      groupsSkipped++
      continue
    }

    existing.sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
      if (aTime !== bTime) return aTime - bTime
      return a.id - b.id
    })
    const canonical = existing[0]
    const redundant = candidates.filter(c => c.id !== canonical.id)

    // Count tracks pointing at each redundant row before repointing, so
    // the summary reflects what actually moved rather than what's left.
    const redundantTrackCounts = await Promise.all(
      redundant.map(row =>
        db.selectFrom('tracks')
          .select(db.fn.count<number>('id').as('count'))
          .where('media_file_id', '=', row.id)
          .executeTakeFirst()
      )
    )
    const totalTracksToRepoint = redundantTrackCounts.reduce((sum, r) => sum + Number(r?.count ?? 0), 0)

    console.log(`  ✅ [hash ${hash}] canonical: media_files ${canonical.id} (${canonical.absolute_path}); repointing ${totalTracksToRepoint} track(s) off ${redundant.length} redundant row(s)${apply ? '' : ' (dry-run, not applied)'}`)

    if (apply) {
      await db.transaction().execute(async (trx) => {
        for (const row of redundant) {
          await trx
            .updateTable('tracks')
            .set({ media_file_id: canonical.id, updated_at: new Date() })
            .where('media_file_id', '=', row.id)
            .execute()
          await trx.deleteFrom('media_files').where('id', '=', row.id).execute()
        }
      })
    }

    for (const row of redundant) {
      let sizeBytes = 0
      if (row.absolute_path && fs.existsSync(row.absolute_path)) {
        sizeBytes = fs.statSync(row.absolute_path).size
      }
      deletable.push({ mediaFileId: row.id, absolutePath: row.absolute_path ?? '(no path recorded)', sizeBytes })
    }

    groupsConsolidated++
    tracksRepointed += totalTracksToRepoint
    rowsDeleted += redundant.length
  }

  console.log(`\n  Groups: ✅ ${groupsConsolidated} consolidated | ⚠️  ${groupsSkipped} skipped (no existing file) | 🎵 ${tracksRepointed} track(s) repointed | 🗑️  ${rowsDeleted} redundant row(s) ${apply ? 'deleted' : 'would be deleted'}`)

  if (deletable.length > 0) {
    const totalBytes = deletable.reduce((sum, f) => sum + f.sizeBytes, 0)
    console.log(`\n📋 DELETABLE FILES (${apply ? 'now safe to delete' : 'would become safe to delete once --apply is run'}) — review before removing anything:`)
    for (const f of deletable) {
      console.log(`DELETABLE\t${f.absolutePath}\t${f.sizeBytes}`)
    }
    console.log(`\n  Total: ${deletable.length} file(s), ${(totalBytes / 1024 / 1024).toFixed(1)} MB`)
  }

  console.log('\n✨ Done')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
