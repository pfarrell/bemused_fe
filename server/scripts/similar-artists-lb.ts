#!/usr/bin/env tsx
// server/scripts/similar-artists-lb.ts
// Usage: npm run similar-artists-lb [-- --max-age=90d] [--artist-id=123] [--force]
//
// Only processes artists that have a MusicBrainz ID.
// --max-age=Nd  Skip artists checked within N days (default 90)
// --artist-id=N Run for a single artist only
// --force       Ignore max-age, recheck all

import 'dotenv/config'
import { db } from '../src/db/database.js'
import { fetchLBSimilarArtists } from '../src/services/listenbrainzSimilar.js'

const args = process.argv.slice(2)
const getArg = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined }
const hasFlag = (flag: string) => args.includes(flag)

const maxAgeArg = args.find(a => a.startsWith('--max-age='))?.split('=')[1]
const singleIdArg = args.find(a => a.startsWith('--artist-id='))?.split('=')[1]
  ?? getArg('--artist-id')

const force = hasFlag('--force')

function parseMaxAge(raw: string | undefined): number {
  if (!raw) return 90
  const match = raw.match(/^(\d+)d?$/)
  return match ? parseInt(match[1]) : 90
}

const resolvedMaxAge = parseMaxAge(maxAgeArg)

async function main() {
  console.log(`\n🎵 ListenBrainz Similar Artists Lookup`)
  console.log(`   Max age: ${force ? 'force recheck' : `${resolvedMaxAge} days`}`)
  if (singleIdArg) console.log(`   Single artist: ${singleIdArg}`)

  let query = db
    .selectFrom('artists')
    .select(['id', 'name', 'musicbrainz_id'])
    .where('musicbrainz_id', 'is not', null)
    .where(eb => eb.exists(
      eb.selectFrom('albums').select('id').whereRef('albums.artist_id', '=', 'artists.id')
    ))

  if (singleIdArg) {
    query = query.where('id', '=', parseInt(singleIdArg)) as typeof query
  }

  const artists = await query.orderBy('name', 'asc').execute()
  console.log(`\n🎤 Processing ${artists.length} artist(s) with MBIDs...\n`)

  let totalMatched = 0
  let totalStubbed = 0
  let totalSkipped = 0

  for (const artist of artists) {
    process.stdout.write(`  ${artist.name} ... `)
    const result = await fetchLBSimilarArtists(
      artist.id,
      artist.musicbrainz_id!,
      { maxAgeDays: resolvedMaxAge, force }
    )

    if (result.skipped) {
      process.stdout.write(`⏭️  skipped\n`)
      totalSkipped++
    } else {
      process.stdout.write(`✅ ${result.matched} matched, ${result.stubbed} stubbed\n`)
      totalMatched += result.matched
      totalStubbed += result.stubbed
    }
  }

  console.log(`\n✨ Done`)
  console.log(`   Matched: ${totalMatched} | Stubbed: ${totalStubbed} | Skipped: ${totalSkipped}`)
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
