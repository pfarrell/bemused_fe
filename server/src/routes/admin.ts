import { Hono } from 'hono'
import { db } from '../db/database.js'
import { sql } from 'kysely'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.BEMUSED_DB })
import {
  lookupAlbumMBID,
  lookupArtistMBID,
  extractMbid,
  getArtistByMbid,
  getReleaseByMbid,
  searchArtistsMB,
  searchReleasesMB,
} from '../services/musicbrainz.js'
import { fetchAlbumArtFromCAA } from '../services/coverArtArchive.js'
import { fetchArtistImageFromFanart } from '../services/fanart.js'
import { fetchSimilarArtists } from '../services/lastfmSimilar.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createSmallVersion } from '../services/imageResize.js'
import NodeID3 from 'node-id3'
import { parseFile } from 'music-metadata'

const MBID_RETRYABLE = ['unmatched', 'not_found', 'low_confidence']

const admin = new Hono()

// Test route to verify admin routing works
admin.get('/test', (c) => {
  return c.json({ message: 'Admin GET routing works!' })
})

// Test POST route
admin.post('/test-post', (c) => {
  return c.json({ message: 'Admin POST routing works!' })
})

// Helper to get the project root directory
// Use environment variable or fall back to calculating from __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// In production, we're deployed to /var/www/bemused-node/current, use that
// In development, calculate from __dirname
const projectRoot = process.env.NODE_ENV === 'production'
  ? '/var/www/bemused-node/current'
  : path.resolve(__dirname, '../../..')

// PUT /admin/artist/:id — update an artist
admin.put('/artist/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()

  const { name, image_path, wikipedia, musicbrainz_id } = body

  if (!name) {
    return c.json({ error: 'Name is required' }, 400)
  }

  try {
    const current = await db
      .selectFrom('artists')
      .select(['name', 'mbid_status', 'musicbrainz_id'])
      .where('id', '=', id)
      .executeTakeFirst()

    if (!current) {
      return c.json({ error: 'Artist not found' }, 404)
    }

    let mbidUpdate: { musicbrainz_id: string | null; mbid_confidence: number | null; mbid_status: string } | null = null

    if (musicbrainz_id !== undefined) {
      const raw = typeof musicbrainz_id === 'string' ? musicbrainz_id.trim() : ''
      if (!raw) {
        if (current.musicbrainz_id) {
          mbidUpdate = { musicbrainz_id: null, mbid_confidence: null, mbid_status: 'unmatched' }
        }
      } else {
        let mbid: string
        try {
          mbid = extractMbid(raw, 'artist')
        } catch (err) {
          return c.json({ error: (err as Error).message }, 400)
        }
        if (mbid !== current.musicbrainz_id) {
          let entity
          try {
            entity = await getArtistByMbid(mbid)
          } catch {
            return c.json({ error: 'Could not reach MusicBrainz to verify — try again' }, 502)
          }
          if (!entity) {
            return c.json({ error: 'No such artist found on MusicBrainz' }, 400)
          }
          mbidUpdate = { musicbrainz_id: mbid, mbid_confidence: 1.0, mbid_status: 'manual' }
        }
      }
    }

    const updated = await db
      .updateTable('artists')
      .set({
        name,
        image_path: image_path || null,
        wikipedia: wikipedia || null,
        updated_at: new Date(),
        ...(mbidUpdate ?? {}),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!updated) {
      return c.json({ error: 'Artist not found' }, 404)
    }

    // If name changed: merge stubs and re-trigger lookup chain (skipped when this
    // same request also manually set/cleared the MBID, so the auto lookup can't
    // race with — and overwrite — the admin's manual choice)
    if (current.name !== name) {
      mergeArtistStubs(id, name).catch(err =>
        console.warn(`mergeArtistStubs failed for artist ${id}:`, err.message)
      )
      if (!mbidUpdate && MBID_RETRYABLE.includes(current.mbid_status ?? 'unmatched')) {
        const imagesDir = path.join(projectRoot, 'public', 'images')
        lookupArtistMBID(id, name).then(async result => {
          if (!result.mbid) return
          await fetchArtistImageFromFanart(id, result.mbid, imagesDir)
          await fetchSimilarArtists(id, name)
        }).catch(err =>
          console.warn(`Post-update lookup chain failed for artist ${id}:`, err.message)
        )
      }
    }

    // Manually-set MBID: re-run the same side effects a fresh auto-match would trigger
    if (mbidUpdate?.mbid_status === 'manual' && mbidUpdate.musicbrainz_id) {
      const imagesDir = path.join(projectRoot, 'public', 'images')
      const mbid = mbidUpdate.musicbrainz_id
      fetchArtistImageFromFanart(id, mbid, imagesDir).catch(err =>
        console.warn(`Manual MBID image fetch failed for artist ${id}:`, err.message)
      )
      fetchSimilarArtists(id, name).catch(err =>
        console.warn(`Manual MBID similar-artist fetch failed for artist ${id}:`, err.message)
      )
    }

    return c.json(updated)
  } catch (error) {
    console.error('Error updating artist:', error)
    return c.json({ error: 'Failed to update artist' }, 500)
  }
})

// PUT /admin/album/:id — update an album
admin.put('/album/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()

  const { title, artist_id, release_year, image_path, wikipedia, is_compilation, musicbrainz_id } = body

  if (!title) {
    return c.json({ error: 'Title is required' }, 400)
  }

  if (!artist_id) {
    return c.json({ error: 'Artist ID is required' }, 400)
  }

  try {
    const current = await db
      .selectFrom('albums')
      .innerJoin('artists', 'artists.id', 'albums.artist_id')
      .select([
        'albums.title',
        'albums.artist_id',
        'albums.mbid_status',
        'albums.musicbrainz_id',
        'albums.release_year',
        'artists.name as artist_name',
      ])
      .where('albums.id', '=', id)
      .executeTakeFirst()

    if (!current) {
      return c.json({ error: 'Album not found' }, 404)
    }

    let mbidUpdate: { musicbrainz_id: string | null; mbid_confidence: number | null; mbid_status: string } | null = null
    let mbidReleaseYear: string | undefined

    if (musicbrainz_id !== undefined) {
      const raw = typeof musicbrainz_id === 'string' ? musicbrainz_id.trim() : ''
      if (!raw) {
        if (current.musicbrainz_id) {
          mbidUpdate = { musicbrainz_id: null, mbid_confidence: null, mbid_status: 'unmatched' }
        }
      } else {
        let mbid: string
        try {
          mbid = extractMbid(raw, 'release')
        } catch (err) {
          return c.json({ error: (err as Error).message }, 400)
        }
        if (mbid !== current.musicbrainz_id) {
          let entity
          try {
            entity = await getReleaseByMbid(mbid)
          } catch {
            return c.json({ error: 'Could not reach MusicBrainz to verify — try again' }, 502)
          }
          if (!entity) {
            return c.json({ error: 'No such release found on MusicBrainz' }, 400)
          }
          mbidUpdate = { musicbrainz_id: mbid, mbid_confidence: 1.0, mbid_status: 'manual' }
          // Prefer the release-group's original release date over this specific
          // edition's — a manually-pasted MBID is often for a remaster/reissue,
          // and the point of auto-filling this is to save the admin from having
          // to go look up the original year by hand.
          mbidReleaseYear = (entity.original_date || entity.date)?.match(/^\d{4}/)?.[0]
        }
      }
    }

    const updated = await db
      .updateTable('albums')
      .set({
        title,
        artist_id,
        release_year: mbidReleaseYear ?? (release_year || null),
        image_path: image_path || null,
        wikipedia: wikipedia || null,
        is_compilation: Boolean(is_compilation),
        updated_at: new Date(),
        ...(mbidUpdate ?? {}),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!updated) {
      return c.json({ error: 'Album not found' }, 404)
    }

    // Re-trigger MBID lookup if matching fields changed and status is retryable
    // (skipped when this same request also manually set/cleared the MBID)
    if (!mbidUpdate && MBID_RETRYABLE.includes(current.mbid_status ?? 'unmatched')) {
      const titleChanged = current.title !== title
      const artistChanged = current.artist_id !== artist_id
      if (titleChanged || artistChanged) {
        // Resolve the new artist name if artist changed
        const artistNamePromise = artistChanged
          ? db.selectFrom('artists').select('name').where('id', '=', artist_id).executeTakeFirst().then(r => r?.name ?? current.artist_name)
          : Promise.resolve(current.artist_name)

        artistNamePromise.then(artistName =>
          lookupAlbumMBID(id, title, artistName, undefined, release_year || null)
        ).catch(err =>
          console.warn(`MBID re-lookup failed for album ${id}:`, err.message)
        )
      }
    }

    // Manually-set MBID: re-run the same side effect (Cover Art Archive image fetch)
    // a fresh auto-match would trigger
    if (mbidUpdate?.mbid_status === 'manual' && mbidUpdate.musicbrainz_id) {
      const imagesDir = path.join(projectRoot, 'public', 'images')
      fetchAlbumArtFromCAA(id, mbidUpdate.musicbrainz_id, imagesDir).catch(err =>
        console.warn(`Manual MBID image fetch failed for album ${id}:`, err.message)
      )
    }

    return c.json(updated)
  } catch (error) {
    console.error('Error updating album:', error)
    return c.json({ error: 'Failed to update album' }, 500)
  }
})

// DELETE /admin/artist/:id — delete an artist and cascade to albums, tracks, media_files
admin.delete('/artist/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  try {
    const artist = await db.selectFrom('artists').select('id').where('id', '=', id).executeTakeFirst()
    if (!artist) return c.json({ error: 'Artist not found' }, 404)

    // Collect all albums for this artist
    const albums = await db.selectFrom('albums').select('id').where('artist_id', '=', id).execute()
    const albumIds = albums.map(a => a.id)

    if (albumIds.length > 0) {
      // Collect media_file IDs from tracks in those albums, then delete them
      const tracks = await db
        .selectFrom('tracks')
        .select(['id', 'media_file_id'])
        .where('album_id', 'in', albumIds)
        .execute()
      const mediaFileIds = tracks.map(t => t.media_file_id).filter((id): id is number => id != null)

      if (tracks.length > 0) {
        await db.deleteFrom('tracks').where('album_id', 'in', albumIds).execute()
      }
      if (mediaFileIds.length > 0) {
        await db.deleteFrom('media_files').where('id', 'in', mediaFileIds).execute()
      }
      await db.deleteFrom('albums').where('id', 'in', albumIds).execute()
    }

    const deleted = await db.deleteFrom('artists').where('id', '=', id).returningAll().executeTakeFirst()
    return c.json({ success: true, deleted })
  } catch (error) {
    console.error('Error deleting artist:', error)
    return c.json({ error: 'Failed to delete artist' }, 500)
  }
})

// DELETE /admin/album/:id — delete an album and cascade to tracks, media_files
admin.delete('/album/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  try {
    const album = await db.selectFrom('albums').select('id').where('id', '=', id).executeTakeFirst()
    if (!album) return c.json({ error: 'Album not found' }, 404)

    const tracks = await db
      .selectFrom('tracks')
      .select(['id', 'media_file_id'])
      .where('album_id', '=', id)
      .execute()
    const mediaFileIds = tracks.map(t => t.media_file_id).filter((id): id is number => id != null)

    if (tracks.length > 0) {
      await db.deleteFrom('tracks').where('album_id', '=', id).execute()
    }
    if (mediaFileIds.length > 0) {
      await db.deleteFrom('media_files').where('id', 'in', mediaFileIds).execute()
    }

    const deleted = await db.deleteFrom('albums').where('id', '=', id).returningAll().executeTakeFirst()
    return c.json({ success: true, deleted })
  } catch (error) {
    console.error('Error deleting album:', error)
    return c.json({ error: 'Failed to delete album' }, 500)
  }
})

// Merge stub artists whose name is highly similar to the given artist into it.
// Stubs are artists with no albums and no tracks, created by the similar-artist lookup.
async function mergeArtistStubs(artistId: number, name: string): Promise<void> {
  const nameLower = name.toLowerCase()
  const { rows: stubs } = await pool.query<{ id: number; name: string }>(
    `SELECT id, name FROM artists
     WHERE id != $1
       AND NOT EXISTS (SELECT 1 FROM albums WHERE albums.artist_id = artists.id)
       AND NOT EXISTS (SELECT 1 FROM tracks WHERE tracks.artist_id = artists.id)
       AND (
         similarity(lower(name), lower($2)) >= 0.5
         OR lower(name) LIKE $3
         OR $4 LIKE '%' || lower(name) || '%'
       )`,
    [artistId, name, `%${nameLower}%`, nameLower]
  )

  for (const stub of stubs) {
    console.log(`  Merging stub artist "${stub.name}" (id=${stub.id}) into "${name}" (id=${artistId})`)

    // Delete relations that would conflict when we update related_artist_id
    await db.deleteFrom('artist_relations').where(eb =>
      eb.and([
        eb('related_artist_id', '=', stub.id),
        eb('artist_id', 'in',
          db.selectFrom('artist_relations').select('artist_id').where('related_artist_id', '=', artistId)
        )
      ])
    ).execute()
    // Also avoid creating a self-relation
    await db.deleteFrom('artist_relations')
      .where('related_artist_id', '=', stub.id)
      .where('artist_id', '=', artistId)
      .execute()

    // Delete relations that would conflict when we update artist_id
    await db.deleteFrom('artist_relations').where(eb =>
      eb.and([
        eb('artist_id', '=', stub.id),
        eb('related_artist_id', 'in',
          db.selectFrom('artist_relations').select('related_artist_id').where('artist_id', '=', artistId)
        )
      ])
    ).execute()
    await db.deleteFrom('artist_relations')
      .where('artist_id', '=', stub.id)
      .where('related_artist_id', '=', artistId)
      .execute()

    // Redirect remaining relations to the real artist
    await db.updateTable('artist_relations').set({ related_artist_id: artistId }).where('related_artist_id', '=', stub.id).execute()
    await db.updateTable('artist_relations').set({ artist_id: artistId }).where('artist_id', '=', stub.id).execute()

    // Delete the stub
    await db.deleteFrom('artists').where('id', '=', stub.id).execute()
    console.log(`  Merged stub artist ${stub.id} into ${artistId}`)
  }
}

// POST /admin/artist — create a new artist stub
admin.post('/artist', async (c) => {
  const body = await c.req.json()
  const { name } = body

  if (!name?.trim()) {
    return c.json({ error: 'Name is required' }, 400)
  }

  try {
    const artist = await db
      .insertInto('artists')
      .values({ name: name.trim() })
      .returningAll()
      .executeTakeFirst()

    if (!artist) return c.json({ error: 'Failed to create artist' }, 500)

    // Merge any matching stubs, then trigger lookup chain
    mergeArtistStubs(artist.id, artist.name).catch(err =>
      console.warn(`mergeArtistStubs failed for new artist ${artist.id}:`, err.message)
    )

    const imagesDir = path.join(projectRoot, 'public', 'images')
    lookupArtistMBID(artist.id, artist.name).then(async result => {
      if (!result.mbid) return
      await fetchArtistImageFromFanart(artist.id, result.mbid, imagesDir)
      await fetchSimilarArtists(artist.id, artist.name)
    }).catch(err =>
      console.warn(`Post-create lookup chain failed for artist ${artist.id}:`, err.message)
    )

    return c.json(artist, 201)
  } catch (error) {
    console.error('Error creating artist:', error)
    return c.json({ error: 'Failed to create artist' }, 500)
  }
})

// POST /admin/album — create a new album stub
admin.post('/album', async (c) => {
  const body = await c.req.json()
  const { title, artist_id } = body

  if (!title?.trim()) return c.json({ error: 'Title is required' }, 400)
  if (!artist_id) return c.json({ error: 'Artist ID is required' }, 400)

  try {
    const artist = await db.selectFrom('artists').select('id').where('id', '=', artist_id).executeTakeFirst()
    if (!artist) return c.json({ error: 'Artist not found' }, 404)

    const album = await db
      .insertInto('albums')
      .values({ title: title.trim(), artist_id })
      .returningAll()
      .executeTakeFirst()

    return c.json(album, 201)
  } catch (error) {
    console.error('Error creating album:', error)
    return c.json({ error: 'Failed to create album' }, 500)
  }
})

// GET /admin/artists/search?q= — artist search including stubs (no albums required)
admin.get('/artists/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  if (q.length < 2) return c.json([])

  const rows = await db
    .selectFrom('artists')
    .leftJoin('albums', 'albums.artist_id', 'artists.id')
    .select((eb) => [
      'artists.id',
      'artists.name',
      'artists.image_path',
      eb.fn.count<number>('albums.id').as('album_count'),
    ])
    .where(sql<boolean>`unaccent(lower(artists.name)) LIKE unaccent(${'%' + q.toLowerCase() + '%'})`)
    .groupBy(['artists.id', 'artists.name', 'artists.image_path'])
    .orderBy(sql<number>`similarity(unaccent(lower(artists.name)), unaccent(lower(${q})))`, 'desc')
    .limit(20)
    .execute()

  return c.json(rows)
})

// GET /admin/albums/search?q= — album search with artist name and track count
admin.get('/albums/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  if (q.length < 2) return c.json([])

  const rows = await db
    .selectFrom('albums')
    .innerJoin('artists', 'artists.id', 'albums.artist_id')
    .leftJoin('tracks', 'tracks.album_id', 'albums.id')
    .select((eb) => [
      'albums.id',
      'albums.title',
      'albums.release_year',
      'artists.name as artist_name',
      eb.fn.count<number>('tracks.id').as('track_count'),
    ])
    .where(sql<boolean>`unaccent(lower(albums.title)) LIKE unaccent(${'%' + q.toLowerCase() + '%'})`)
    .groupBy(['albums.id', 'albums.title', 'albums.release_year', 'artists.name'])
    .orderBy(sql<number>`similarity(unaccent(lower(albums.title)), unaccent(lower(${q})))`, 'desc')
    .limit(10)
    .execute()

  return c.json(rows)
})

// GET /admin/musicbrainz/search-artist?q= — proxy an artist search to MusicBrainz
admin.get('/musicbrainz/search-artist', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  if (q.length < 2) return c.json([])

  try {
    const results = await searchArtistsMB(q)
    return c.json(results)
  } catch (error) {
    console.error('MusicBrainz artist search failed:', error)
    return c.json({ error: 'Could not reach MusicBrainz to search — try again' }, 502)
  }
})

// GET /admin/musicbrainz/search-release?q= — proxy a release search to MusicBrainz
admin.get('/musicbrainz/search-release', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  if (q.length < 2) return c.json([])

  try {
    const results = await searchReleasesMB(q)
    return c.json(results)
  } catch (error) {
    console.error('MusicBrainz release search failed:', error)
    return c.json({ error: 'Could not reach MusicBrainz to search — try again' }, 502)
  }
})

// GET /admin/artist/:id/merge-stubs — preview which stubs would be merged
admin.get('/artist/:id/merge-stubs', async (c) => {
  const id = parseInt(c.req.param('id'))
  try {
    const artist = await db.selectFrom('artists').select(['id', 'name']).where('id', '=', id).executeTakeFirst()
    if (!artist) return c.json({ error: 'Artist not found' }, 404)

    const { rows } = await pool.query<{ id: number; name: string; similarity: number; album_count: number }>(
      `SELECT a.id, a.name,
              similarity(lower(a.name), lower($1)) AS similarity,
              COUNT(al.id) AS album_count
       FROM artists a
       LEFT JOIN albums al ON al.artist_id = a.id
       WHERE a.id != $2
         AND similarity(lower(a.name), lower($1)) >= 0.5
       GROUP BY a.id, a.name
       ORDER BY similarity DESC`,
      [artist.name, id]
    )

    return c.json(rows)
  } catch (error) {
    console.error('Error previewing stubs:', error)
    return c.json({ error: 'Failed to preview stubs' }, 500)
  }
})

// POST /admin/artist/:id/merge — merge one or more other artists into this one.
// Direction-agnostic: the frontend decides which artist survives by choosing
// which id goes in the URL vs loser_ids (see docs/superpowers/specs/2026-07-05-artist-merge-ux-design.md).
admin.post('/artist/:id/merge', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const loserIds: number[] = body.loser_ids ?? []
  if (loserIds.length === 0) return c.json({ error: 'No loser_ids provided' }, 400)
  if (loserIds.includes(id)) return c.json({ error: 'Cannot merge an artist into itself' }, 400)

  try {
    const artist = await db.selectFrom('artists').select(['id', 'name']).where('id', '=', id).executeTakeFirst()
    if (!artist) return c.json({ error: 'Artist not found' }, 404)

    for (const stubId of loserIds) {
      const stub = await db.selectFrom('artists').select(['id', 'name']).where('id', '=', stubId).executeTakeFirst()
      if (!stub) continue

      console.log(`  Merging relations from "${stub.name}" (id=${stub.id}) into "${artist.name}" (id=${artist.id})`)

      await db.deleteFrom('artist_relations').where(eb =>
        eb.and([
          eb('related_artist_id', '=', stub.id),
          eb('artist_id', 'in',
            db.selectFrom('artist_relations').select('artist_id').where('related_artist_id', '=', artist.id)
          )
        ])
      ).execute()
      await db.deleteFrom('artist_relations').where('related_artist_id', '=', stub.id).where('artist_id', '=', artist.id).execute()
      await db.deleteFrom('artist_relations').where(eb =>
        eb.and([
          eb('artist_id', '=', stub.id),
          eb('related_artist_id', 'in',
            db.selectFrom('artist_relations').select('related_artist_id').where('artist_id', '=', artist.id)
          )
        ])
      ).execute()
      await db.deleteFrom('artist_relations').where('artist_id', '=', stub.id).where('related_artist_id', '=', artist.id).execute()

      await db.updateTable('artist_relations').set({ related_artist_id: artist.id }).where('related_artist_id', '=', stub.id).execute()
      await db.updateTable('artist_relations').set({ artist_id: artist.id }).where('artist_id', '=', stub.id).execute()

      // Re-point albums/tracks still pointing at the stub before deleting it — otherwise
      // this orphans them (albums.artist_id / tracks.artist_id have no FK constraint, so
      // the delete below would succeed silently and leave dangling references).
      await db.updateTable('albums').set({ artist_id: artist.id }).where('artist_id', '=', stub.id).execute()
      await db.updateTable('tracks').set({ artist_id: artist.id }).where('artist_id', '=', stub.id).execute()

      // Re-point non-primary album credits (collaborator/featured/guest/compilation)
      // too. Unlike albums/tracks above, artist_albums.artist_id has ON DELETE CASCADE
      // — without this, the stub's credits would just be silently destroyed by the
      // delete below instead of transferred to the target artist.
      await db.deleteFrom('artist_albums').where(eb =>
        eb.and([
          eb('artist_id', '=', stub.id),
          eb('album_id', 'in',
            db.selectFrom('artist_albums').select('album_id').where('artist_id', '=', artist.id)
          )
        ])
      ).execute()
      await db.updateTable('artist_albums').set({ artist_id: artist.id }).where('artist_id', '=', stub.id).execute()

      await db.deleteFrom('artists').where('id', '=', stub.id).execute()
    }

    return c.json({ success: true, merged: loserIds.length })
  } catch (error) {
    console.error('Error merging artists:', error)
    return c.json({ error: 'Failed to merge artists' }, 500)
  }
})

// POST /admin/artist/:id/image — download and save artist image
admin.post('/artist/:id/image', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { image_url, image_name } = body

  if (!image_url || !image_name) {
    return c.json({ error: 'image_url and image_name are required' }, 400)
  }

  try {
    // Download the image
    console.log(`Downloading artist image from: ${image_url}`)
    const response = await fetch(image_url)
    if (!response.ok) {
      return c.json({ error: 'Failed to download image from URL' }, 400)
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    // Determine the image directory
    const imageDir = path.join(projectRoot, 'public', 'images', 'artists')
    console.log(`Saving artist image to directory: ${imageDir}`)

    // Create directory if it doesn't exist
    if (!fs.existsSync(imageDir)) {
      console.log(`Creating directory: ${imageDir}`)
      fs.mkdirSync(imageDir, { recursive: true })
    }

    // Save the image
    const imagePath = path.join(imageDir, image_name)
    console.log(`Writing artist image to: ${imagePath}`)
    fs.writeFileSync(imagePath, buffer)
    console.log(`Artist image saved successfully: ${imagePath}`)

    // Update the artist record
    const updated = await db
      .updateTable('artists')
      .set({
        image_path: image_name,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!updated) {
      return c.json({ error: 'Artist not found' }, 404)
    }

    return c.json({ success: true, artist: updated })
  } catch (error) {
    console.error('Error downloading/saving artist image:', error)
    return c.json({ error: 'Failed to save image' }, 500)
  }
})

// POST /admin/album/:id/image — download and save album image
admin.post('/album/:id/image', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { image_url, image_name } = body

  if (!image_url || !image_name) {
    return c.json({ error: 'image_url and image_name are required' }, 400)
  }

  try {
    // Download the image
    console.log(`Downloading album image from: ${image_url}`)
    const response = await fetch(image_url)
    if (!response.ok) {
      return c.json({ error: 'Failed to download image from URL' }, 400)
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    // Determine the image directory
    const imageDir = path.join(projectRoot, 'public', 'images', 'albums')
    console.log(`Saving album image to directory: ${imageDir}`)

    // Create directory if it doesn't exist
    if (!fs.existsSync(imageDir)) {
      console.log(`Creating directory: ${imageDir}`)
      fs.mkdirSync(imageDir, { recursive: true })
    }

    // Save the image
    const imagePath = path.join(imageDir, image_name)
    console.log(`Writing album image to: ${imagePath}`)
    fs.writeFileSync(imagePath, buffer)
    console.log(`Album image saved successfully: ${imagePath}`)

    // Update the album record
    const updated = await db
      .updateTable('albums')
      .set({
        image_path: image_name,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!updated) {
      return c.json({ error: 'Album not found' }, 404)
    }

    return c.json({ success: true, album: updated })
  } catch (error) {
    console.error('Error downloading/saving album image:', error)
    return c.json({ error: 'Failed to save image' }, 500)
  }
})

// POST /admin/playlist/:id/image — download and save playlist image
admin.post('/playlist/:id/image', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { image_url, image_name } = body

  if (!image_url || !image_name) {
    return c.json({ error: 'image_url and image_name are required' }, 400)
  }

  try {
    // Download the image
    console.log(`Downloading playlist image from: ${image_url}`)
    const response = await fetch(image_url)
    if (!response.ok) {
      return c.json({ error: 'Failed to download image from URL' }, 400)
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    // Determine the image directory (use albums directory for playlists too)
    const imageDir = path.join(projectRoot, 'public', 'images', 'albums')
    console.log(`Saving playlist image to directory: ${imageDir}`)

    // Create directory if it doesn't exist
    if (!fs.existsSync(imageDir)) {
      console.log(`Creating directory: ${imageDir}`)
      fs.mkdirSync(imageDir, { recursive: true })
    }

    // Save the image
    const imagePath = path.join(imageDir, image_name)
    console.log(`Writing playlist image to: ${imagePath}`)
    fs.writeFileSync(imagePath, buffer)
    console.log(`Playlist image saved successfully: ${imagePath}`)

    // Update the playlist record
    const updated = await db
      .updateTable('playlists')
      .set({
        image_path: image_name,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!updated) {
      return c.json({ error: 'Playlist not found' }, 404)
    }

    return c.json({ success: true, playlist: updated })
  } catch (error) {
    console.error('Error downloading/saving playlist image:', error)
    return c.json({ error: 'Failed to save image' }, 500)
  }
})

// POST /admin/collection/:id/image — download and save collection image
admin.post('/collection/:id/image', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { image_url, image_name } = body

  if (!image_url || !image_name) {
    return c.json({ error: 'image_url and image_name are required' }, 400)
  }

  try {
    const response = await fetch(image_url)
    if (!response.ok) return c.json({ error: 'Failed to download image from URL' }, 400)

    const buffer = Buffer.from(await response.arrayBuffer())
    const imageDir = path.join(projectRoot, 'public', 'images', 'albums')
    if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true })

    const imagePath = path.join(imageDir, image_name)
    fs.writeFileSync(imagePath, buffer)

    const updated = await db
      .updateTable('collections')
      .set({ image_path: image_name, updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!updated) return c.json({ error: 'Collection not found' }, 404)
    return c.json({ success: true, collection: updated })
  } catch (error) {
    console.error('Error downloading/saving collection image:', error)
    return c.json({ error: 'Failed to save image' }, 500)
  }
})

// PUT /admin/track/:id — update a track
admin.put('/track/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()

  const { title, track_number, album_id, artist_id } = body

  try {
    const updated = await db
      .updateTable('tracks')
      .set({
        ...(title !== undefined && { title }),
        ...(track_number !== undefined && { track_number }),
        ...(album_id !== undefined && { album_id }),
        ...(artist_id !== undefined && { artist_id }),
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!updated) {
      return c.json({ error: 'Track not found' }, 404)
    }

    return c.json(updated)
  } catch (error) {
    console.error('Error updating track:', error)
    return c.json({ error: 'Failed to update track' }, 500)
  }
})

// POST /admin/track/:id/make-single — removes a track from its album and files
// it under the track's own artist's singles pseudo-album (an album titled
// '_Singles', one per artist; read by GET /artist/:id, see routes/artists.ts).
// Creates that album on first use for the artist. The track's artist_id is
// left unchanged — it's what determines which artist's singles it joins,
// which matters for a compilation track credited to someone other than the
// album's nominal artist.
const SINGLES_ALBUM_TITLE = '_Singles'

admin.post('/track/:id/make-single', async (c) => {
  const id = parseInt(c.req.param('id'))

  const track = await db
    .selectFrom('tracks')
    .select(['id', 'artist_id'])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!track) return c.json({ error: 'Track not found' }, 404)
  if (!track.artist_id) return c.json({ error: 'Track has no artist' }, 400)

  try {
    let singlesAlbum = await db
      .selectFrom('albums')
      .select(['id'])
      .where('artist_id', '=', track.artist_id)
      .where('title', '=', SINGLES_ALBUM_TITLE)
      .executeTakeFirst()

    if (!singlesAlbum) {
      singlesAlbum = await db
        .insertInto('albums')
        .values({ title: SINGLES_ALBUM_TITLE, artist_id: track.artist_id })
        .returning(['id'])
        .executeTakeFirstOrThrow()
    }

    const maxTrackNumberRow = await db
      .selectFrom('tracks')
      .select(sql<number | null>`MAX(track_number::integer)`.as('max_track_number'))
      .where('album_id', '=', singlesAlbum.id)
      .executeTakeFirst()

    const nextTrackNumber = (maxTrackNumberRow?.max_track_number ?? 0) + 1

    const updated = await db
      .updateTable('tracks')
      .set({ album_id: singlesAlbum.id, track_number: String(nextTrackNumber), updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    return c.json({ ...updated, album: { id: singlesAlbum.id, title: SINGLES_ALBUM_TITLE } })
  } catch (error) {
    console.error('Error making track a single:', error)
    return c.json({ error: 'Failed to make track a single' }, 500)
  }
})

// DELETE /admin/track/:id — delete a track
admin.delete('/track/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  try {
    const deleted = await db
      .deleteFrom('tracks')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!deleted) {
      return c.json({ error: 'Track not found' }, 404)
    }

    return c.json({ success: true, deleted })
  } catch (error) {
    console.error('Error deleting track:', error)
    return c.json({ error: 'Failed to delete track' }, 500)
  }
})

// PATCH /admin/album/:id/tracks — bulk update all tracks in an album
admin.patch('/album/:id/tracks', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()

  const { album_id, artist_id } = body

  try {
    // Get all tracks for this album
    const tracks = await db
      .selectFrom('tracks')
      .selectAll()
      .where('album_id', '=', id)
      .execute()

    if (!tracks || tracks.length === 0) {
      return c.json({ error: 'No tracks found for this album' }, 404)
    }

    // Update all tracks with the provided fields
    const updateData: any = {
      updated_at: new Date(),
    }

    if (album_id !== undefined) {
      updateData.album_id = album_id
    }

    if (artist_id !== undefined) {
      updateData.artist_id = artist_id
    }

    await db
      .updateTable('tracks')
      .set(updateData)
      .where('album_id', '=', id)
      .execute()

    return c.json({
      success: true,
      message: 'All tracks updated successfully',
      updated_count: tracks.length
    })
  } catch (error) {
    console.error('Error bulk updating tracks:', error)
    return c.json({ error: 'Failed to bulk update tracks' }, 500)
  }
})


// POST /admin/album/:id/move-to-artist — move album and all its tracks to a new artist
admin.post('/album/:id/move-to-artist', async (c) => {
  const albumId = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { target_artist_id } = body

  if (!target_artist_id) {
    return c.json({ error: 'target_artist_id is required' }, 400)
  }

  const targetArtistId = parseInt(target_artist_id)

  try {
    // Verify album exists
    const album = await db
      .selectFrom('albums')
      .select(['id', 'artist_id', 'is_compilation'])
      .where('id', '=', albumId)
      .executeTakeFirst()

    if (!album) {
      return c.json({ error: 'Album not found' }, 404)
    }

    // Verify target artist exists
    const targetArtist = await db
      .selectFrom('artists')
      .select('id')
      .where('id', '=', targetArtistId)
      .executeTakeFirst()

    if (!targetArtist) {
      return c.json({ error: 'Target artist not found' }, 404)
    }

    // Update the album
    await db
      .updateTable('albums')
      .set({ artist_id: targetArtistId, updated_at: new Date() })
      .where('id', '=', albumId)
      .execute()

    // Update all tracks for this album — but only when it's a normal album,
    // where every track legitimately shares the album's artist. A compilation's
    // tracks are individually credited (see docs/architecture.md); blindly
    // overwriting tracks.artist_id here would destroy every per-track credit
    // just because the album's own container artist_id changed.
    let tracksMovedCount = 0
    if (!album.is_compilation) {
      const tracksResult = await db
        .updateTable('tracks')
        .set({ artist_id: targetArtistId, updated_at: new Date() })
        .where('album_id', '=', albumId)
        .execute()
      tracksMovedCount = Number(tracksResult[0]?.numUpdatedRows || 0)
    }

    return c.json({
      success: true,
      tracks_moved: tracksMovedCount,
      is_compilation: album.is_compilation,
    })
  } catch (error) {
    console.error('Error moving album to new artist:', error)
    return c.json({ error: 'Failed to move album' }, 500)
  }
})

// POST /admin/album/:id/merge — merge all tracks into another album, then delete this album
// Body: { destination_album_id: number, track_offset: number }
// track_offset is added to each track's track_number (0 = no change)
// Track artist_id is updated to match destination album's artist, unless destination is a flagged compilation
admin.post('/album/:id/merge', async (c) => {
  const sourceAlbumId = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { destination_album_id, track_offset = 0 } = body

  if (!destination_album_id) return c.json({ error: 'destination_album_id is required' }, 400)
  if (sourceAlbumId === parseInt(destination_album_id)) return c.json({ error: 'Cannot merge an album into itself' }, 400)

  const destAlbum = await db
    .selectFrom('albums')
    .select(['id', 'artist_id', 'is_compilation'])
    .where('id', '=', parseInt(destination_album_id))
    .executeTakeFirst()

  if (!destAlbum) return c.json({ error: 'Destination album not found' }, 404)

  const sourceAlbum = await db
    .selectFrom('albums')
    .select('id')
    .where('id', '=', sourceAlbumId)
    .executeTakeFirst()

  if (!sourceAlbum) return c.json({ error: 'Source album not found' }, 404)

  try {
    const offset = parseInt(track_offset) || 0

    if (offset > 0) {
      await db
        .updateTable('tracks')
        .set({ track_number: sql`track_number::integer + ${offset}`, updated_at: new Date() })
        .where('album_id', '=', sourceAlbumId)
        .execute()
    }

    const updateSet: Record<string, any> = { album_id: destAlbum.id, updated_at: new Date() }
    if (!destAlbum.is_compilation) {
      updateSet.artist_id = destAlbum.artist_id
    }

    const result = await db
      .updateTable('tracks')
      .set(updateSet)
      .where('album_id', '=', sourceAlbumId)
      .execute()

    await db.deleteFrom('albums').where('id', '=', sourceAlbumId).execute()

    return c.json({ success: true, tracks_moved: Number(result[0]?.numUpdatedRows || 0) })
  } catch (error) {
    console.error('Error merging album:', error)
    return c.json({ error: 'Failed to merge album' }, 500)
  }
})

// Re-reads ID3 tags for a single track's file. Returns null if the file
// can't be read (missing media_file_id, file_missing flag, or fs error) —
// callers must skip that track rather than propose changes for it.
async function readTrackTags(track: { media_file_id: number | null }): Promise<{
  title: string | undefined
  trackNumber: number | null
  artist: string | undefined
  year: string | undefined
  album: string | undefined
} | null> {
  if (!track.media_file_id) return null

  const mediaFile = await db
    .selectFrom('media_files')
    .select(['absolute_path', 'file_missing'])
    .where('id', '=', track.media_file_id)
    .executeTakeFirst()

  if (!mediaFile || !mediaFile.absolute_path || mediaFile.file_missing) return null
  if (!fs.existsSync(mediaFile.absolute_path)) return null

  try {
    const tags = NodeID3.read(mediaFile.absolute_path)
    const metadata = await parseFile(mediaFile.absolute_path)
    const rawTrackNumber = extractTrackNumber(tags.trackNumber)
    return {
      title: tags.title,
      trackNumber: rawTrackNumber,
      artist: tags.artist,
      year: tags.year || metadata.common.year?.toString(),
      album: tags.album,
    }
  } catch {
    return null
  }
}

// Mirrors the "5/12" track-number tag format handled in
// server/src/workers/queue-handler.ts's extractTrackNumber.
function extractTrackNumber(trackTag: string | null | undefined): number | null {
  if (!trackTag) return null
  const match = trackTag.toString().match(/^(\d+)/)
  return match ? parseInt(match[1]) : null
}

// GET /admin/album/:id/reprocess-preview — re-read ID3 tags from each
// track's file and diff against the DB. Read-only; no writes happen here.
admin.get('/album/:id/reprocess-preview', async (c) => {
  const albumId = parseInt(c.req.param('id'))

  const album = await db
    .selectFrom('albums')
    .select(['id', 'title', 'release_year', 'is_compilation'])
    .where('id', '=', albumId)
    .executeTakeFirst()

  if (!album) {
    return c.json({ error: 'Album not found' }, 404)
  }

  const tracks = await db
    .selectFrom('tracks')
    .leftJoin('artists', 'artists.id', 'tracks.artist_id')
    .select([
      'tracks.id as id',
      'tracks.title as title',
      'tracks.track_number as track_number',
      'tracks.media_file_id as media_file_id',
      'artists.id as artist_id',
      'artists.name as artist_name',
    ])
    .where('tracks.album_id', '=', albumId)
    .execute()

  const trackDiffs = []
  const skipped: { track_id: number; reason: string }[] = []
  let proposedYear: string | undefined
  let proposedAlbumTitle: string | undefined

  for (const track of tracks) {
    const tags = await readTrackTags({ media_file_id: track.media_file_id })

    if (!tags) {
      skipped.push({
        track_id: track.id,
        reason: track.media_file_id ? 'file missing on disk' : 'no media file linked',
      })
      continue
    }

    if (proposedYear === undefined) proposedYear = tags.year
    if (proposedAlbumTitle === undefined) proposedAlbumTitle = tags.album

    const diff: any = {
      id: track.id,
      fields: {
        title: {
          current: track.title,
          proposed: tags.title ?? track.title,
        },
        track_number: {
          current: track.track_number !== null ? parseInt(track.track_number) : null,
          // Fall back to the current value when the file has no track-number
          // tag, same as title/release_year/artist below — never propose
          // blanking a field just because this one file lacks that tag.
          proposed: tags.trackNumber ?? (track.track_number !== null ? parseInt(track.track_number) : null),
        },
      },
    }

    if (album.is_compilation) {
      const proposedName = tags.artist || track.artist_name
      const matched = await db
        .selectFrom('artists')
        .select(['id', 'name'])
        .where('name', '=', proposedName)
        .executeTakeFirst()

      diff.artist = {
        current: track.artist_id ? { id: track.artist_id, name: track.artist_name } : null,
        proposed_name: proposedName,
        matched_artist: matched || null,
      }
    }

    trackDiffs.push(diff)
  }

  return c.json({
    album: {
      id: album.id,
      is_compilation: album.is_compilation,
      fields: {
        title: {
          current: album.title,
          proposed: proposedAlbumTitle ?? album.title,
        },
        release_year: {
          current: album.release_year !== null ? parseInt(album.release_year) : null,
          proposed: proposedYear !== undefined ? parseInt(proposedYear) : (album.release_year !== null ? parseInt(album.release_year) : null),
        },
      },
    },
    tracks: trackDiffs,
    skipped,
  })
})

// POST /admin/album/:id/reprocess-apply — commit only the accepted/edited
// fields from a prior reprocess-preview response, in one transaction.
admin.post('/album/:id/reprocess-apply', async (c) => {
  const albumId = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const albumFields = body.album || {}
  const trackFields: any[] = body.tracks || []

  const album = await db
    .selectFrom('albums')
    .select(['id', 'is_compilation'])
    .where('id', '=', albumId)
    .executeTakeFirst()

  if (!album) {
    return c.json({ error: 'Album not found' }, 404)
  }

  if (albumFields.release_year !== undefined && albumFields.release_year !== null) {
    if (!/^\d+$/.test(String(albumFields.release_year))) {
      return c.json({ error: 'album.release_year must be an integer' }, 400)
    }
  }

  for (const t of trackFields) {
    if (t.track_number !== undefined && t.track_number !== null) {
      if (!/^\d+$/.test(String(t.track_number))) {
        return c.json({ error: `tracks[id=${t.id}].track_number must be an integer` }, 400)
      }
    }
    if (t.artist_name !== undefined && !album.is_compilation) {
      return c.json({ error: `tracks[id=${t.id}].artist_name is only allowed on compilation albums` }, 400)
    }
  }

  try {
    await db.transaction().execute(async (trx) => {
      const albumUpdate: any = {}
      if (albumFields.title !== undefined) albumUpdate.title = albumFields.title
      if (albumFields.release_year !== undefined) {
        albumUpdate.release_year = albumFields.release_year === null ? null : String(albumFields.release_year)
      }
      if (Object.keys(albumUpdate).length > 0) {
        albumUpdate.updated_at = new Date()
        await trx.updateTable('albums').set(albumUpdate).where('id', '=', albumId).execute()
      }

      for (const t of trackFields) {
        const trackUpdate: any = {}
        if (t.title !== undefined) trackUpdate.title = t.title
        if (t.track_number !== undefined) {
          trackUpdate.track_number = t.track_number === null ? null : String(t.track_number)
        }

        if (t.artist_name !== undefined) {
          // A null/empty artist_name means "no artist was proposed" (e.g. a
          // compilation track with no assigned artist and no ID3 artist tag
          // on its file) — treat it as "no change" rather than looking up or
          // creating a blank-named artist row.
          const artistName = typeof t.artist_name === 'string' ? t.artist_name.trim() : t.artist_name
          if (artistName) {
            let artist = await trx
              .selectFrom('artists')
              .select('id')
              .where('name', '=', artistName)
              .executeTakeFirst()

            if (!artist) {
              artist = await trx
                .insertInto('artists')
                .values({ name: artistName })
                .returning('id')
                .executeTakeFirstOrThrow()
            }
            trackUpdate.artist_id = artist.id
          }
        }

        if (Object.keys(trackUpdate).length > 0) {
          trackUpdate.updated_at = new Date()
          // Scope to albumId too — a stale/malformed payload posting a track id that
          // belongs to a different album must never write to it. If the id doesn't
          // belong to this album, this simply affects 0 rows (silent no-op for that
          // entry), which is acceptable per the finding's scope.
          await trx.updateTable('tracks').set(trackUpdate).where('id', '=', t.id).where('album_id', '=', albumId).execute()
        }
      }
    })

    return c.json({ success: true })
  } catch (error) {
    console.error('Error applying reprocess changes:', error)
    return c.json({ error: 'Failed to apply changes' }, 500)
  }
})

// GET /admin/album/:id/artists — list non-primary artists for an album
admin.get('/album/:id/artists', async (c) => {
  const id = parseInt(c.req.param('id'))
  try {
    const rows = await db
      .selectFrom('artist_albums')
      .innerJoin('artists', 'artists.id', 'artist_albums.artist_id')
      .select([
        'artist_albums.artist_id',
        'artist_albums.role',
        'artist_albums.order',
        'artists.name',
      ])
      .where('artist_albums.album_id', '=', id)
      .where('artist_albums.role', '!=', 'primary')
      .orderBy('artist_albums.order', 'asc')
      .execute()
    return c.json(rows)
  } catch (error) {
    console.error('Error fetching album artists:', error)
    return c.json({ error: 'Failed to fetch album artists' }, 500)
  }
})

// POST /admin/album/:id/artists — add a non-primary artist to an album
admin.post('/album/:id/artists', async (c) => {
  const albumId = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { artist_id, role } = body

  if (!artist_id || !role) {
    return c.json({ error: 'artist_id and role are required' }, 400)
  }
  if (!['compilation', 'featured', 'guest', 'collaborator'].includes(role)) {
    return c.json({ error: 'Invalid role. Must be compilation, featured, guest, or collaborator' }, 400)
  }

  try {
    const existing = await db
      .selectFrom('artist_albums')
      .select('order')
      .where('album_id', '=', albumId)
      .execute()
    const nextOrder = existing.length > 0 ? Math.max(...existing.map(r => r.order)) + 1 : 1

    const inserted = await db
      .insertInto('artist_albums')
      .values({ artist_id, album_id: albumId, role, order: nextOrder })
      .returningAll()
      .executeTakeFirst()

    return c.json(inserted)
  } catch (error: any) {
    if (error.code === '23505') {
      return c.json({ error: 'This artist is already associated with this album' }, 409)
    }
    console.error('Error adding artist to album:', error)
    return c.json({ error: 'Failed to add artist to album' }, 500)
  }
})

// DELETE /admin/album/:id/artists/:artist_id — remove a non-primary artist from an album
admin.delete('/album/:id/artists/:artist_id', async (c) => {
  const albumId = parseInt(c.req.param('id'))
  const artistId = parseInt(c.req.param('artist_id'))

  try {
    const deleted = await db
      .deleteFrom('artist_albums')
      .where('album_id', '=', albumId)
      .where('artist_id', '=', artistId)
      .where('role', '!=', 'primary')
      .returningAll()
      .executeTakeFirst()

    if (!deleted) {
      return c.json({ error: 'Relationship not found or cannot remove primary artist' }, 404)
    }
    return c.json({ success: true })
  } catch (error) {
    console.error('Error removing artist from album:', error)
    return c.json({ error: 'Failed to remove artist from album' }, 500)
  }
})

// GET /admin/artist/:id/albums — list non-primary albums for an artist
admin.get('/artist/:id/albums', async (c) => {
  const id = parseInt(c.req.param('id'))
  try {
    const rows = await db
      .selectFrom('artist_albums')
      .innerJoin('albums', 'albums.id', 'artist_albums.album_id')
      .select([
        'artist_albums.album_id',
        'artist_albums.role',
        'albums.title',
        'albums.release_year',
      ])
      .where('artist_albums.artist_id', '=', id)
      .where('artist_albums.role', '!=', 'primary')
      .orderBy('albums.release_year', 'asc')
      .execute()
    return c.json(rows)
  } catch (error) {
    console.error('Error fetching artist albums:', error)
    return c.json({ error: 'Failed to fetch artist albums' }, 500)
  }
})

// POST /admin/artist/:id/albums — add a non-primary album to an artist
admin.post('/artist/:id/albums', async (c) => {
  const artistId = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { album_id, role } = body

  if (!album_id || !role) {
    return c.json({ error: 'album_id and role are required' }, 400)
  }
  if (!['compilation', 'featured', 'guest', 'collaborator'].includes(role)) {
    return c.json({ error: 'Invalid role. Must be compilation, featured, guest, or collaborator' }, 400)
  }

  try {
    const existing = await db
      .selectFrom('artist_albums')
      .select('order')
      .where('album_id', '=', album_id)
      .execute()
    const nextOrder = existing.length > 0 ? Math.max(...existing.map(r => r.order)) + 1 : 1

    const inserted = await db
      .insertInto('artist_albums')
      .values({ artist_id: artistId, album_id, role, order: nextOrder })
      .returningAll()
      .executeTakeFirst()

    return c.json(inserted)
  } catch (error: any) {
    if (error.code === '23505') {
      return c.json({ error: 'This artist is already associated with this album' }, 409)
    }
    console.error('Error adding album to artist:', error)
    return c.json({ error: 'Failed to add album to artist' }, 500)
  }
})

// DELETE /admin/artist/:id/albums/:album_id — remove a non-primary album from an artist
admin.delete('/artist/:id/albums/:album_id', async (c) => {
  const artistId = parseInt(c.req.param('id'))
  const albumId = parseInt(c.req.param('album_id'))

  try {
    const deleted = await db
      .deleteFrom('artist_albums')
      .where('artist_id', '=', artistId)
      .where('album_id', '=', albumId)
      .where('role', '!=', 'primary')
      .returningAll()
      .executeTakeFirst()

    if (!deleted) {
      return c.json({ error: 'Relationship not found or cannot remove primary relationship' }, 404)
    }
    return c.json({ success: true })
  } catch (error) {
    console.error('Error removing album from artist:', error)
    return c.json({ error: 'Failed to remove album from artist' }, 500)
  }
})

// GET /admin/artist/:id/related — list related artists, members, and similar artists
admin.get('/artist/:id/related', async (c) => {
  const id = parseInt(c.req.param('id'))
  try {
    const rows = await db
      .selectFrom('artist_relations')
      .innerJoin('artists', 'artists.id', 'artist_relations.related_artist_id')
      .select(['artists.id', 'artists.name', 'artist_relations.kind', 'artist_relations.source', 'artist_relations.similarity', 'artist_relations.is_hidden', 'artist_relations.force_show'])
      .where('artist_relations.artist_id', '=', id)
      .orderBy('artist_relations.similarity', 'desc')
      .orderBy('artists.name', 'asc')
      .execute()
    return c.json(rows)
  } catch (error) {
    console.error('Error fetching related artists:', error)
    return c.json({ error: 'Failed to fetch related artists' }, 500)
  }
})

// PATCH /admin/artist/:id/related/:related_id/force-show — toggle force_show on a relation
admin.patch('/artist/:id/related/:related_id/force-show', async (c) => {
  const artistId = parseInt(c.req.param('id'))
  const relatedId = parseInt(c.req.param('related_id'))
  const body = await c.req.json()
  const forceShow: boolean = body.force_show ?? true

  try {
    await db
      .updateTable('artist_relations')
      .set({ force_show: forceShow })
      .where(eb => eb.or([
        eb.and([eb('artist_id', '=', artistId), eb('related_artist_id', '=', relatedId)]),
        eb.and([eb('artist_id', '=', relatedId), eb('related_artist_id', '=', artistId)]),
      ]))
      .execute()

    return c.json({ success: true, force_show: forceShow })
  } catch (error) {
    console.error('Error toggling force_show:', error)
    return c.json({ error: 'Failed to update relation' }, 500)
  }
})

// PATCH /admin/artist/:id/related/:related_id/hide — toggle is_hidden on a relation
admin.patch('/artist/:id/related/:related_id/hide', async (c) => {
  const artistId = parseInt(c.req.param('id'))
  const relatedId = parseInt(c.req.param('related_id'))
  const body = await c.req.json()
  const hidden: boolean = body.hidden ?? true

  try {
    // Toggle both directions so the relation is hidden symmetrically
    await db
      .updateTable('artist_relations')
      .set({ is_hidden: hidden })
      .where(eb => eb.or([
        eb.and([eb('artist_id', '=', artistId), eb('related_artist_id', '=', relatedId)]),
        eb.and([eb('artist_id', '=', relatedId), eb('related_artist_id', '=', artistId)]),
      ]))
      .execute()

    return c.json({ success: true, hidden })
  } catch (error) {
    console.error('Error toggling relation visibility:', error)
    return c.json({ error: 'Failed to update relation' }, 500)
  }
})

// POST /admin/artist/:id/related — add relation (symmetric for 'related', one-directional for 'member')
admin.post('/artist/:id/related', async (c) => {
  const artistId = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const relatedId = parseInt(body.related_artist_id)
  const kind: string = body.kind ?? 'related'

  if (!relatedId || isNaN(relatedId)) {
    return c.json({ error: 'related_artist_id is required' }, 400)
  }
  if (artistId === relatedId) {
    return c.json({ error: 'An artist cannot be related to itself' }, 400)
  }

  try {
    const rows = kind === 'member'
      ? [{ artist_id: artistId, related_artist_id: relatedId, kind, source: 'manual', similarity: 1.0 }]
      : [
          { artist_id: artistId, related_artist_id: relatedId, kind, source: 'manual', similarity: 1.0 },
          { artist_id: relatedId, related_artist_id: artistId, kind, source: 'manual', similarity: 1.0 },
        ]

    await db
      .insertInto('artist_relations')
      .values(rows)
      .onConflict((oc) => oc.doNothing())
      .execute()

    return c.json({ success: true })
  } catch (error) {
    console.error('Error adding related artist:', error)
    return c.json({ error: 'Failed to add related artist' }, 500)
  }
})

// DELETE /admin/artist/:id/related/:related_id — remove relation
admin.delete('/artist/:id/related/:related_id', async (c) => {
  const artistId = parseInt(c.req.param('id'))
  const relatedId = parseInt(c.req.param('related_id'))

  try {
    // Look up the kind to determine if we remove one or both directions
    const existing = await db
      .selectFrom('artist_relations')
      .select('kind')
      .where('artist_id', '=', artistId)
      .where('related_artist_id', '=', relatedId)
      .executeTakeFirst()

    const kind = existing?.kind ?? 'related'

    if (kind === 'member') {
      // One-directional: only remove artistId → relatedId
      await db
        .deleteFrom('artist_relations')
        .where('artist_id', '=', artistId)
        .where('related_artist_id', '=', relatedId)
        .execute()
    } else {
      // Symmetric: remove both directions
      await db
        .deleteFrom('artist_relations')
        .where((eb) =>
          eb.or([
            eb.and([
              eb('artist_id', '=', artistId),
              eb('related_artist_id', '=', relatedId),
            ]),
            eb.and([
              eb('artist_id', '=', relatedId),
              eb('related_artist_id', '=', artistId),
            ]),
          ])
        )
        .execute()
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Error removing related artist:', error)
    return c.json({ error: 'Failed to remove related artist' }, 500)
  }
})

// --- Image management helpers ---

type EntityKind = 'album' | 'artist'

async function getImagesForEntity(entityKind: EntityKind, entityId: number) {
  const field = entityKind === 'album' ? 'album_id' : 'artist_id'
  return db
    .selectFrom('images')
    .leftJoin('media_files', (join) =>
      join
        .onRef('media_files.entity_id', '=', 'images.id')
        .on('media_files.entity_type', '=', 'image')
    )
    .select([
      'images.id',
      'images.is_primary',
      'images.source',
      'images.status',
      'images.width',
      'images.height',
      'images.created_at',
      'media_files.absolute_path as path',
    ])
    .where(`images.${field}` as any, '=', entityId)
    // 'not_found' rows are bookkeeping only (an external lookup came back
    // empty) — they have no backing file and would render as a blank tile.
    .where('images.status', '!=', 'not_found')
    .orderBy('images.is_primary', 'desc')
    .orderBy('images.created_at', 'asc')
    .execute()
}

async function downloadAndSaveImage(
  imageUrl: string,
  imageName: string,
  subdir: 'albums' | 'artists'
): Promise<string> {
  const response = await fetch(imageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bemused/1.0)' }
  })
  if (!response.ok) throw new Error(`Failed to download image: ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  const imageDir = path.join(projectRoot, 'public', 'images', subdir)
  if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true })
  const imagePath = path.join(imageDir, imageName)
  fs.writeFileSync(imagePath, buffer)
  await createSmallVersion(imagePath)
  return imageName
}

async function createImageRecord(
  entityKind: EntityKind,
  entityId: number,
  filePath: string,
  source: string,
  isPrimary: boolean,
  status: string = 'active'
) {
  const image = await db
    .insertInto('images')
    .values({
      ...(entityKind === 'album' ? { album_id: entityId } : { artist_id: entityId }),
      is_primary: isPrimary,
      source,
      status,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  await db
    .insertInto('media_files')
    .values({
      entity_type: 'image',
      entity_id: image.id,
      discriminator: 'image',
      absolute_path: filePath,
      name: filePath,
      file_type: 'image',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute()

  // If primary, sync image_path on the parent record and clear other primaries
  if (isPrimary) {
    await db
      .updateTable('images')
      .set({ is_primary: false })
      .where(entityKind === 'album' ? 'album_id' : 'artist_id', '=', entityId)
      .where('id', '!=', image.id)
      .execute()

    if (entityKind === 'album') {
      await db.updateTable('albums').set({ image_path: filePath, updated_at: new Date() }).where('id', '=', entityId).execute()
    } else {
      await db.updateTable('artists').set({ image_path: filePath, updated_at: new Date() }).where('id', '=', entityId).execute()
    }
  }

  return image
}

// GET /admin/album/:id/images
admin.get('/album/:id/images', async (c) => {
  const id = parseInt(c.req.param('id'))
  const images = await getImagesForEntity('album', id)
  return c.json(images)
})

// POST /admin/album/:id/images — download and add a new image
admin.post('/album/:id/images', async (c) => {
  const id = parseInt(c.req.param('id'))
  const { image_url, image_name, set_primary = false } = await c.req.json()
  if (!image_url || !image_name) return c.json({ error: 'image_url and image_name are required' }, 400)

  try {
    const filePath = await downloadAndSaveImage(image_url, image_name, 'albums')
    const image = await createImageRecord('album', id, filePath, 'manual', set_primary)
    return c.json({ success: true, image })
  } catch (err) {
    console.error('Error adding album image:', err)
    return c.json({ error: 'Failed to save image' }, 500)
  }
})

// PATCH /admin/album/:id/images/:imgId/primary — set as primary
admin.patch('/album/:id/images/:imgId/primary', async (c) => {
  const albumId = parseInt(c.req.param('id'))
  const imgId = parseInt(c.req.param('imgId'))

  try {
    // Clear existing primary
    await db.updateTable('images').set({ is_primary: false }).where('album_id', '=', albumId).execute()
    // Set new primary
    const image = await db
      .updateTable('images')
      .set({ is_primary: true })
      .where('id', '=', imgId)
      .where('album_id', '=', albumId)
      .returningAll()
      .executeTakeFirst()

    if (!image) return c.json({ error: 'Image not found' }, 404)

    // Sync image_path
    const mf = await db.selectFrom('media_files').select('absolute_path').where('entity_type', '=', 'image').where('entity_id', '=', imgId).executeTakeFirst()
    if (mf?.absolute_path) {
      await db.updateTable('albums').set({ image_path: mf.absolute_path, updated_at: new Date() }).where('id', '=', albumId).execute()
    }

    return c.json({ success: true, image })
  } catch (err) {
    console.error('Error setting primary image:', err)
    return c.json({ error: 'Failed to set primary image' }, 500)
  }
})

// DELETE /admin/album/:id/images/:imgId
admin.delete('/album/:id/images/:imgId', async (c) => {
  const albumId = parseInt(c.req.param('id'))
  const imgId = parseInt(c.req.param('imgId'))

  try {
    const image = await db.deleteFrom('images').where('id', '=', imgId).where('album_id', '=', albumId).returningAll().executeTakeFirst()
    if (!image) return c.json({ error: 'Image not found' }, 404)
    await db.deleteFrom('media_files').where('entity_type', '=', 'image').where('entity_id', '=', imgId).execute()
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Failed to delete image' }, 500)
  }
})

// GET /admin/artist/:id/images
admin.get('/artist/:id/images', async (c) => {
  const id = parseInt(c.req.param('id'))
  const images = await getImagesForEntity('artist', id)
  return c.json(images)
})

// POST /admin/artist/:id/images
admin.post('/artist/:id/images', async (c) => {
  const id = parseInt(c.req.param('id'))
  const { image_url, image_name, set_primary = false } = await c.req.json()
  if (!image_url || !image_name) return c.json({ error: 'image_url and image_name are required' }, 400)

  try {
    const filePath = await downloadAndSaveImage(image_url, image_name, 'artists')
    const image = await createImageRecord('artist', id, filePath, 'manual', set_primary)
    return c.json({ success: true, image })
  } catch (err) {
    return c.json({ error: (err as Error).message || 'Failed to save image' }, 500)
  }
})

// PATCH /admin/artist/:id/images/:imgId/primary
admin.patch('/artist/:id/images/:imgId/primary', async (c) => {
  const artistId = parseInt(c.req.param('id'))
  const imgId = parseInt(c.req.param('imgId'))

  try {
    await db.updateTable('images').set({ is_primary: false }).where('artist_id', '=', artistId).execute()
    const image = await db
      .updateTable('images')
      .set({ is_primary: true })
      .where('id', '=', imgId)
      .where('artist_id', '=', artistId)
      .returningAll()
      .executeTakeFirst()

    if (!image) return c.json({ error: 'Image not found' }, 404)

    const mf = await db.selectFrom('media_files').select('absolute_path').where('entity_type', '=', 'image').where('entity_id', '=', imgId).executeTakeFirst()
    if (mf?.absolute_path) {
      await db.updateTable('artists').set({ image_path: mf.absolute_path, updated_at: new Date() }).where('id', '=', artistId).execute()
    }

    return c.json({ success: true, image })
  } catch (err) {
    return c.json({ error: 'Failed to set primary image' }, 500)
  }
})

// DELETE /admin/artist/:id/images/:imgId
admin.delete('/artist/:id/images/:imgId', async (c) => {
  const artistId = parseInt(c.req.param('id'))
  const imgId = parseInt(c.req.param('imgId'))

  try {
    const image = await db.deleteFrom('images').where('id', '=', imgId).where('artist_id', '=', artistId).returningAll().executeTakeFirst()
    if (!image) return c.json({ error: 'Image not found' }, 404)
    await db.deleteFrom('media_files').where('entity_type', '=', 'image').where('entity_id', '=', imgId).execute()
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Failed to delete image' }, 500)
  }
})

export default admin
