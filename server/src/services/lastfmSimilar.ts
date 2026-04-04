// server/src/services/lastfmSimilar.ts
// Fetches similar artists from last.fm and stores them in artist_relations.
//
// Matching strategy (in order):
//   1. Case-insensitive exact name match in artists table
//   2. Case-insensitive contains match (both directions), take if only one result
//   3. Create a stub artist (no albums/tracks) — filtered from UI grids automatically

import { db } from '../db/database.js'
import { lastfmUrl } from './lastfm.js'
import { sql } from 'kysely'

const RATE_LIMIT_MS = 1100
let lastRequestTime = 0

async function rateLimitedFetch(url: string): Promise<any> {
  const now = Date.now()
  const wait = RATE_LIMIT_MS - (now - lastRequestTime)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastRequestTime = Date.now()
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Last.fm error: ${res.status}`)
  return res.json()
}

export interface SimilarArtistsResult {
  matched: number
  stubbed: number
  skipped: boolean
}

export async function fetchSimilarArtists(
  artistId: number,
  artistName: string,
  options: { maxAgeDays?: number; force?: boolean } = {}
): Promise<SimilarArtistsResult> {
  const maxAgeDays = options.maxAgeDays ?? 90

  if (!options.force) {
    const existing = await db
      .selectFrom('external_lookups')
      .select('checked_at')
      .where('entity_type', '=', 'artist')
      .where('entity_id', '=', artistId)
      .where('service', '=', 'lastfm_similar')
      .executeTakeFirst()

    if (existing) {
      const ageDays = (Date.now() - new Date(existing.checked_at).getTime()) / (1000 * 60 * 60 * 24)
      if (ageDays < maxAgeDays) return { matched: 0, stubbed: 0, skipped: true }
    }
  }

  // Fetch from last.fm
  let data: any
  try {
    const url = lastfmUrl({
      method: 'artist.getSimilar',
      artist: artistName,
      limit: '100',
      autocorrect: '1',
    })
    data = await rateLimitedFetch(url)
  } catch (err) {
    console.warn(`  ⚠️  Last.fm similar failed for artist ${artistId}: ${(err as Error).message}`)
    await upsertLookup(artistId, 'error')
    return { matched: 0, stubbed: 0, skipped: false }
  }

  const similar: any[] = data?.similarartists?.artist ?? []

  if (similar.length === 0) {
    await upsertLookup(artistId, 'not_found')
    return { matched: 0, stubbed: 0, skipped: false }
  }

  let matched = 0
  let stubbed = 0

  for (const item of similar) {
    const name: string = item.name
    const similarity: number = parseFloat(item.match || '0')

    let relatedArtist = await resolveArtist(name)

    if (!relatedArtist) {
      // Create stub artist — no unique constraint on name, so use try/catch + SELECT fallback
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
    for (const [a, b] of [[artistId, relatedArtist.id], [relatedArtist.id, artistId]] as [number, number][]) {
      await db
        .insertInto('artist_relations')
        .values({ artist_id: a, related_artist_id: b, kind: 'similar', source: 'lastfm', similarity })
        .onConflict(oc => oc
          .columns(['artist_id', 'related_artist_id'])
          // kind is intentionally not updated — manual 'related' rows must not be reclassified by algorithmic sources
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

async function resolveArtist(name: string): Promise<{ id: number; name: string } | undefined> {
  // 1. Exact case-insensitive match
  const exact = await db
    .selectFrom('artists')
    .select(['id', 'name'])
    .where(sql`lower(name)`, '=', name.toLowerCase())
    .executeTakeFirst()
  if (exact) return exact

  // 2. Contains match — both directions (e.g. "The Beatles" ↔ "Beatles")
  const escapedName = name.toLowerCase().replace(/%/g, '\\%').replace(/_/g, '\\_')
  const candidates = await db
    .selectFrom('artists')
    .select(['id', 'name'])
    .where(sql<boolean>`lower(name) LIKE ${'%' + escapedName + '%'} OR ${name.toLowerCase()} LIKE '%' || lower(name) || '%'`)
    .limit(3)
    .execute()

  // Only use the contains match if exactly one result and names are close
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
      service: 'lastfm_similar',
      checked_at: new Date(),
      result,
    })
    .onConflict(oc => oc
      .columns(['entity_type', 'entity_id', 'service'])
      .doUpdateSet({ checked_at: new Date(), result })
    )
    .execute()
}
