// server/src/services/listenbrainzSimilar.ts
// Fetches similar artists from ListenBrainz and stores them in artist_relations.
//
// Matching strategy (in order):
//   1. MusicBrainz ID match in artists table
//   2. Case-insensitive exact name match
//   3. Case-insensitive contains match (single result only)
//   4. Create a stub artist (no albums/tracks)

import { db } from '../db/database.js'
import { sql } from 'kysely'

const LB_BASE = 'https://labs.api.listenbrainz.org'
const RATE_LIMIT_MS = 1100
let lastRequestTime = 0

async function rateLimitedFetch(url: string): Promise<any> {
  const now = Date.now()
  const wait = RATE_LIMIT_MS - (now - lastRequestTime)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastRequestTime = Date.now()
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ListenBrainz error: ${res.status}`)
  return res.json()
}

export interface LBSimilarArtistsResult {
  matched: number
  stubbed: number
  skipped: boolean
}

export async function fetchLBSimilarArtists(
  artistId: number,
  artistMbid: string,
  options: { maxAgeDays?: number; force?: boolean } = {}
): Promise<LBSimilarArtistsResult> {
  const maxAgeDays = options.maxAgeDays ?? 90

  if (!options.force) {
    const existing = await db
      .selectFrom('external_lookups')
      .select('checked_at')
      .where('entity_type', '=', 'artist')
      .where('entity_id', '=', artistId)
      .where('service', '=', 'listenbrainz_similar')
      .executeTakeFirst()

    if (existing) {
      const ageDays = (Date.now() - new Date(existing.checked_at).getTime()) / (1000 * 60 * 60 * 24)
      if (ageDays < maxAgeDays) return { matched: 0, stubbed: 0, skipped: true }
    }
  }

  let data: any
  try {
    // ListenBrainz Labs endpoint returns JSON array of similar artists
    // Using session_based_days_7500 algorithm (comprehensive dataset)
    data = await rateLimitedFetch(
      `${LB_BASE}/similar-artists/json?artist_mbids=${artistMbid}&algorithm=session_based_days_7500_session_300_contribution_3_threshold_10_limit_100_filter_True_skip_30`
    )
  } catch (err) {
    console.warn(`  ⚠️  ListenBrainz similar failed for artist ${artistId}: ${(err as Error).message}`)
    await upsertLookup(artistId, 'error')
    return { matched: 0, stubbed: 0, skipped: false }
  }

  // Response is an array (empty array if no results, 404 throws above)
  const similar: any[] = Array.isArray(data) ? data : []

  if (similar.length === 0) {
    await upsertLookup(artistId, 'not_found')
    return { matched: 0, stubbed: 0, skipped: false }
  }

  let matched = 0
  let stubbed = 0

  for (const item of similar) {
    const itemMbid: string = item.artist_mbid
    const name: string = item.name
    if (!name || !itemMbid) continue
    // LB returns 'score' field (integer); normalize to 0-1 by dividing by typical max (around 1000)
    // Fall back to 'similarity' in case API changes
    const score: number = parseFloat(item.score ?? item.similarity ?? 0)
    const similarity: number = Math.min(score / 1000, 1)

    let relatedArtist = await resolveArtist(itemMbid, name)

    if (!relatedArtist) {
      // Create stub artist
      try {
        relatedArtist = await db
          .insertInto('artists')
          .values({ name })
          .returning(['id', 'name'])
          .executeTakeFirst()
        if (relatedArtist) stubbed++
      } catch {
        // Name collision — find the existing artist by exact name
        relatedArtist = await db
          .selectFrom('artists')
          .select(['id', 'name'])
          .where('name', '=', name)
          .executeTakeFirst()
        if (relatedArtist) matched++
      }
    } else {
      matched++
    }

    if (!relatedArtist || relatedArtist.id === artistId) continue

    // Upsert both directions symmetrically
    // kind is intentionally not updated — manual 'related' rows must not be reclassified by algorithmic sources
    for (const [a, b] of [[artistId, relatedArtist.id], [relatedArtist.id, artistId]] as [number, number][]) {
      await db
        .insertInto('artist_relations')
        .values({ artist_id: a, related_artist_id: b, kind: 'related', source: 'listenbrainz', similarity })
        .onConflict(oc => oc
          .columns(['artist_id', 'related_artist_id'])
          .doUpdateSet({
            similarity: sql<number>`GREATEST(artist_relations.similarity, EXCLUDED.similarity)`,
            source: sql<string>`CASE
              WHEN artist_relations.kind = 'related' THEN artist_relations.source
              WHEN EXCLUDED.similarity > COALESCE(artist_relations.similarity, -1) THEN EXCLUDED.source
              ELSE artist_relations.source
            END`,
          })
        )
        .execute()
    }
  }

  await upsertLookup(artistId, 'found')
  return { matched, stubbed, skipped: false }
}

async function resolveArtist(mbid: string, name: string): Promise<{ id: number; name: string } | undefined> {
  // 1. MusicBrainz ID match — most reliable
  const byMbid = await db
    .selectFrom('artists')
    .select(['id', 'name'])
    .where('musicbrainz_id', '=', mbid)
    .executeTakeFirst()
  if (byMbid) return byMbid

  // 2. Exact case-insensitive name match
  const exact = await db
    .selectFrom('artists')
    .select(['id', 'name'])
    .where(sql`lower(name)`, '=', name.toLowerCase())
    .executeTakeFirst()
  if (exact) return exact

  // 3. Contains match — both directions (e.g. "The Beatles" ↔ "Beatles")
  const escapedName = name.toLowerCase().replace(/%/g, '\\%').replace(/_/g, '\\_')
  const candidates = await db
    .selectFrom('artists')
    .select(['id', 'name'])
    .where(sql<boolean>`lower(name) LIKE ${'%' + escapedName + '%'} OR ${name.toLowerCase()} LIKE '%' || lower(name) || '%'`)
    .limit(3)
    .execute()

  if (candidates.length === 1) {
    const candidate = candidates[0]
    const a = candidate.name.toLowerCase()
    const b = name.toLowerCase()
    if (a.includes(b) || b.includes(a)) return candidate
  }

  return undefined
}

async function upsertLookup(artistId: number, result: string): Promise<void> {
  await db
    .insertInto('external_lookups')
    .values({
      entity_type: 'artist',
      entity_id: artistId,
      service: 'listenbrainz_similar',
      checked_at: new Date(),
      result,
    })
    .onConflict(oc => oc
      .columns(['entity_type', 'entity_id', 'service'])
      .doUpdateSet({ checked_at: new Date(), result })
    )
    .execute()
}
