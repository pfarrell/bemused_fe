#!/usr/bin/env tsx
// server/scripts/verify-search.ts
// Standalone verification for the search ranking/quoting/index redesign.
// Inserts temporary fixtures, runs assertions against searchService and the
// quote-parsing logic, then always cleans up. The backend has no test
// framework yet (see CLAUDE.md) — this follows the same one-off-script
// pattern as the other scripts in this directory.
//
// Usage: npm run verify-search

import 'dotenv/config'
import { db } from '../src/db/database.js'
import { searchService } from '../src/services/searchService.js'
import { parseQuoted } from '../src/routes/search.js'

let failures = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`)
  } else {
    console.log(`  ❌ ${message}`)
    failures++
  }
}

async function main() {
  console.log('Quote parsing')
  assert(parseQuoted('"cafe"').exactOnly === true, 'straight quotes detected')
  assert(parseQuoted('“cafe”').exactOnly === true, 'curly quotes detected')
  assert(parseQuoted('“cafe"').exactOnly === true, 'mixed straight/curly quotes detected')
  assert(parseQuoted('cafe').exactOnly === false, 'unquoted query is not exact-only')
  assert(parseQuoted('"cafe"').query === 'cafe', 'quotes stripped from query text')

  // Setup and assertions share a single try/finally so that a failure at ANY
  // point during fixture setup (not just during the assertions) still runs
  // cleanup. The finally block below deletes by name/title LIKE 'Verify %'
  // rather than by ID list, since it's reachable before some of the inserts
  // below have necessarily succeeded — an ID-list delete referencing a
  // variable that never got assigned would itself throw inside finally.
  try {
    console.log('\nFixture setup')
    const artist = await db
      .insertInto('artists')
      .values({ name: 'Verify Café Artist', created_at: new Date(), updated_at: new Date() })
      .returningAll()
      .executeTakeFirstOrThrow()
    const album = await db
      .insertInto('albums')
      .values({
        title: 'Verify Search Album',
        artist_id: artist.id,
        is_compilation: false,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    const track = await db
      .insertInto('tracks')
      .values({
        title: 'Verify Search Track',
        album_id: album.id,
        artist_id: artist.id,
        approved: true,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    const closeArtist = await db
      .insertInto('artists')
      .values({ name: 'Verify Cafeteria Artist', created_at: new Date(), updated_at: new Date() })
      .returningAll()
      .executeTakeFirstOrThrow()
    const closeAlbum = await db
      .insertInto('albums')
      .values({
        title: 'Verify Search Album Two',
        artist_id: closeArtist.id,
        is_compilation: false,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    const closeTrack = await db
      .insertInto('tracks')
      .values({
        title: 'Verify Search Track Two',
        album_id: closeAlbum.id,
        artist_id: closeArtist.id,
        approved: true,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    console.log('\nAccent symmetry (exact ILIKE branch)')
    const unaccentedQuery = await searchService.runUnionSearch(
      '%verify cafe artist%',
      'verify cafe artist',
      false,
      30,
      0
    )
    assert(
      unaccentedQuery.some((r) => r.model_type === 'Artist' && r.id === artist.id),
      'unaccented query "cafe" matches accented stored name "Café"'
    )

    const accentedQuery = await searchService.runUnionSearch(
      '%verify café artist%',
      'verify café artist',
      false,
      30,
      0
    )
    assert(
      accentedQuery.some((r) => r.model_type === 'Artist' && r.id === artist.id),
      'accented query "café" matches accented stored name "Café" (both sides normalized)'
    )

    console.log('\nExact match outranks fuzzy match')
    const rankedRows = await searchService.runUnionSearch(
      '%verify search album%',
      'verify search album',
      false,
      30,
      0
    )
    const exactIdx = rankedRows.findIndex((r) => r.model_type === 'Album' && r.id === album.id)
    const fuzzyIdx = rankedRows.findIndex((r) => r.model_type === 'Album' && r.id === closeAlbum.id)
    assert(exactIdx !== -1 && fuzzyIdx !== -1, 'both the exact and fuzzy album matches are present')
    assert(
      exactIdx !== -1 && fuzzyIdx !== -1 && exactIdx < fuzzyIdx,
      'exact substring match ("Verify Search Album") ranks above the fuzzy match ("Verify Search Album Two")'
    )

    console.log('\nPagination: limit/offset produce disjoint, stable pages')
    const page1 = await searchService.runUnionSearch('%verify %', 'verify', false, 2, 0)
    const page2 = await searchService.runUnionSearch('%verify %', 'verify', false, 2, 2)
    const page1Keys = page1.map((r) => `${r.model_type}:${r.id}`)
    const page2Keys = page2.map((r) => `${r.model_type}:${r.id}`)
    assert(page1.length === 2, 'page 1 (limit=2, offset=0) returns exactly 2 rows')
    assert(
      page1Keys.every((k) => !page2Keys.includes(k)),
      'page 2 (offset=2) contains no row already returned on page 1'
    )
    const fullPage = await searchService.runUnionSearch('%verify %', 'verify', false, 4, 0)
    assert(
      fullPage.length >= 4 && page1Keys.every((k, i) => `${fullPage[i].model_type}:${fullPage[i].id}` === k),
      'a single limit=4 fetch reproduces the same first two rows as the separate limit=2 page 1 fetch (stable ordering)'
    )

    console.log('\nrunUnionSearch rejects a negative offset')
    let threw = false
    try {
      await searchService.runUnionSearch('%verify %', 'verify', false, 2, -1)
    } catch {
      threw = true
    }
    assert(threw, 'negative offset throws instead of silently querying with it')

    console.log('\nQuoted exact-only mode skips the fuzzy branch')
    const exactOnlyRows = await searchService.runUnionSearch('%verify search album%', '', true, 30, 0)
    assert(
      exactOnlyRows.some((r) => r.model_type === 'Album' && r.id === album.id),
      'exact-only search still finds the literal substring match'
    )

    console.log('\nTracks are matched independently of the ranked union')
    // Deliberately query with the TRACK fixture's own title (not the album
    // query reused above) — a query that only matches track titles is the
    // one that would actually surface a regression if tracks leaked into
    // the ranked union again.
    const trackQueryRows = await searchService.runUnionSearch(
      '%verify search track%',
      'verify search track',
      false,
      30,
      0
    )
    assert(
      trackQueryRows.every((r) => r.model_type !== 'Track'),
      'the ranked union never contains a Track row, even for a query that matches track titles'
    )
    const trackIds = await searchService.findTrackIds('%verify search track%')
    assert(trackIds.includes(track.id), 'track title match found via findTrackIds')

    console.log('\nCollections and playlists participate in the ranked union')
    // Inserted inside the same outer try as everything else (not a separate
    // nested try/finally) — the single outer finally below deletes by name
    // pattern, so it cleans these up too regardless of whether the playlist
    // insert ever ran (e.g. if the collection insert succeeded but the
    // playlist insert threw).
    const collection = await db
      .insertInto('collections')
      .values({ name: 'Verify Search Collection', created_at: new Date(), updated_at: new Date() })
      .returningAll()
      .executeTakeFirstOrThrow()
    const playlist = await db
      .insertInto('playlists')
      .values({ name: 'Verify Search Playlist', created_at: new Date(), updated_at: new Date() })
      .returningAll()
      .executeTakeFirstOrThrow()
    const collectionRows = await searchService.runUnionSearch(
      '%verify search collection%',
      'verify search collection',
      false,
      30,
      0
    )
    assert(
      collectionRows.some((r) => r.model_type === 'Collection' && r.id === collection.id),
      'collection name match found in the ranked union'
    )
    const playlistRows = await searchService.runUnionSearch(
      '%verify search playlist%',
      'verify search playlist',
      false,
      30,
      0
    )
    assert(
      playlistRows.some((r) => r.model_type === 'Playlist' && r.id === playlist.id),
      'playlist name match found in the ranked union'
    )
  } finally {
    console.log('\nFixture cleanup')
    // Name/title-pattern deletes (not ID-based) so cleanup runs correctly
    // regardless of how far fixture setup got before an exception — every
    // fixture inserted by this script starts with "Verify ", so this sweeps
    // up all fixtures (artists/albums/tracks/collections/playlists) no
    // matter which insert failed or was never reached.
    await db.deleteFrom('tracks').where('title', 'like', 'Verify %').execute()
    await db.deleteFrom('albums').where('title', 'like', 'Verify %').execute()
    await db.deleteFrom('artists').where('name', 'like', 'Verify %').execute()
    await db.deleteFrom('playlists').where('name', 'like', 'Verify %').execute()
    await db.deleteFrom('collections').where('name', 'like', 'Verify %').execute()
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
