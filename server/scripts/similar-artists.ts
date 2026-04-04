#!/usr/bin/env tsx
// server/scripts/similar-artists.ts
// Usage: npm run similar-artists [-- --service=lastfm|listenbrainz] [--max-age=90d] [--artist-id=123] [--force]
//
// --service=X     Only run one service: 'lastfm' or 'listenbrainz' (default: both)
// --max-age=Nd    Skip artists checked within N days (default 90)
// --artist-id=N   Run for a single artist only
// --force         Ignore max-age, recheck all artists
//
// When both services run, each artist is fully processed (lastfm + listenbrainz)
// before moving to the next artist.

import 'dotenv/config'
import { db } from '../src/db/database.js'
import { fetchSimilarArtists } from '../src/services/lastfmSimilar.js'
import { fetchLBSimilarArtists } from '../src/services/listenbrainzSimilar.js'

const args = process.argv.slice(2)
const getArg = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined }
const hasFlag = (flag: string) => args.includes(flag)

const maxAgeArg = args.find(a => a.startsWith('--max-age='))?.split('=')[1]
const singleIdArg = args.find(a => a.startsWith('--artist-id='))?.split('=')[1] ?? getArg('--artist-id')
const serviceArg = args.find(a => a.startsWith('--service='))?.split('=')[1] ?? getArg('--service')
const force = hasFlag('--force')

const runLastfm = !serviceArg || serviceArg === 'lastfm'
const runListenbrainz = !serviceArg || serviceArg === 'listenbrainz'

function parseMaxAge(raw: string | undefined): number {
  if (!raw) return 90
  const match = raw.match(/^(\d+)d?$/)
  return match ? parseInt(match[1]) : 90
}

const resolvedMaxAge = force ? 0 : parseMaxAge(maxAgeArg)

async function main() {
  console.log(`\n🎵 Similar Artists Lookup`)
  console.log(`   Services: ${[runLastfm && 'Last.fm', runListenbrainz && 'ListenBrainz'].filter(Boolean).join(', ')}`)
  console.log(`   Max age: ${force ? 'force recheck' : `${resolvedMaxAge} days`}`)
  if (singleIdArg) console.log(`   Single artist: ${singleIdArg}`)

  let query = db
    .selectFrom('artists')
    .select(['id', 'name', 'musicbrainz_id'])
    .where(eb => eb.exists(
      eb.selectFrom('albums').select('id').whereRef('albums.artist_id', '=', 'artists.id')
    ))

  if (singleIdArg) query = query.where('id', '=', parseInt(singleIdArg)) as typeof query

  const artists = await query.orderBy('name', 'asc').execute()
  console.log(`\n🎤 Processing ${artists.length} artist(s)...\n`)

  const totals = {
    lastfm: { matched: 0, stubbed: 0, skipped: 0 },
    lb: { matched: 0, stubbed: 0, skipped: 0 },
  }

  for (const artist of artists) {
    const hasMbid = !!artist.musicbrainz_id
    const parts: string[] = []

    if (runLastfm) {
      const result = await fetchSimilarArtists(artist.id, artist.name, { maxAgeDays: resolvedMaxAge, force })
      if (result.skipped) {
        parts.push('lfm:⏭️')
        totals.lastfm.skipped++
      } else {
        parts.push(`lfm:✅${result.matched}m/${result.stubbed}s`)
        totals.lastfm.matched += result.matched
        totals.lastfm.stubbed += result.stubbed
      }
    }

    if (runListenbrainz) {
      if (hasMbid) {
        const result = await fetchLBSimilarArtists(artist.id, artist.musicbrainz_id!, { maxAgeDays: resolvedMaxAge, force })
        if (result.skipped) {
          parts.push('lb:⏭️')
          totals.lb.skipped++
        } else {
          parts.push(`lb:✅${result.matched}m/${result.stubbed}s`)
          totals.lb.matched += result.matched
          totals.lb.stubbed += result.stubbed
        }
      } else {
        parts.push('lb:no mbid')
      }
    }

    console.log(`  ${artist.name} — ${parts.join('  ')}`)
  }

  console.log(`\n✨ Done`)
  if (runLastfm)
    console.log(`   Last.fm:      matched ${totals.lastfm.matched} | stubbed ${totals.lastfm.stubbed} | skipped ${totals.lastfm.skipped}`)
  if (runListenbrainz)
    console.log(`   ListenBrainz: matched ${totals.lb.matched} | stubbed ${totals.lb.stubbed} | skipped ${totals.lb.skipped}`)

  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
