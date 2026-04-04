#!/usr/bin/env tsx
// server/scripts/diagnose-similar.ts
// Fetch similar artists from last.fm and ListenBrainz for a single artist.
// No DB writes — diagnostic only.
//
// Usage:
//   npm run diagnose-similar -- --artist-id=123
//   npm run diagnose-similar -- --artist-id=123 --limit=20

import 'dotenv/config'
import { db } from '../src/db/database.js'
import { lastfmUrl } from '../src/services/lastfm.js'

const args = process.argv.slice(2)
const singleIdArg = args.find(a => a.startsWith('--artist-id='))?.split('=')[1]
const limitArg = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '20')

if (!singleIdArg) {
  console.error('Usage: npm run diagnose-similar -- --artist-id=<id> [--limit=20]')
  process.exit(1)
}

const LB_BASE = 'https://labs.api.listenbrainz.org'

async function main() {
  const artist = await db
    .selectFrom('artists')
    .select(['id', 'name', 'musicbrainz_id'])
    .where('id', '=', parseInt(singleIdArg!))
    .executeTakeFirst()

  if (!artist) {
    console.error(`Artist ${singleIdArg} not found`)
    process.exit(1)
  }

  console.log(`\n🎤 ${artist.name} (id=${artist.id}, mbid=${artist.musicbrainz_id ?? 'none'})\n`)

  // --- Last.fm ---
  console.log('─'.repeat(60))
  console.log('🔴 Last.fm — artist.getSimilar')
  console.log('─'.repeat(60))
  try {
    const url = lastfmUrl({ method: 'artist.getSimilar', artist: artist.name, limit: String(limitArg), autocorrect: '1' })
    const res = await fetch(url)
    const data = await res.json() as any
    const similar: any[] = data?.similarartists?.artist ?? []
    if (similar.length === 0) {
      console.log('  (no results)')
    } else {
      similar.slice(0, limitArg).forEach((item, i) => {
        const score = parseFloat(item.match || '0')
        console.log(`  ${String(i + 1).padStart(2)}. ${item.name.padEnd(40)} score=${score.toFixed(4)}`)
      })
    }
  } catch (err) {
    console.error('  Error:', (err as Error).message)
  }

  // --- ListenBrainz ---
  console.log()
  console.log('─'.repeat(60))
  console.log('🟠 ListenBrainz — similar-artists')
  console.log('─'.repeat(60))
  if (!artist.musicbrainz_id) {
    console.log('  (no MBID — skipping)')
  } else {
    try {
      const url = `${LB_BASE}/similar-artists/json?artist_mbids=${artist.musicbrainz_id}&algorithm=session_based_days_7500_session_300_contribution_3_threshold_10_limit_100_filter_True_skip_30`
      const res = await fetch(url)
      const data = await res.json() as any[]
      const similar: any[] = Array.isArray(data) ? data : []
      if (similar.length === 0) {
        console.log('  (no results)')
      } else {
        similar.slice(0, limitArg).forEach((item, i) => {
          const rawScore = item.score ?? item.similarity ?? 0
          const normalized = Math.min(rawScore / 1000, 1)
          console.log(`  ${String(i + 1).padStart(2)}. ${item.name.padEnd(40)} raw=${rawScore} normalized=${normalized.toFixed(3)}`)
        })
      }
    } catch (err) {
      console.error('  Error:', (err as Error).message)
    }
  }

  console.log()
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
