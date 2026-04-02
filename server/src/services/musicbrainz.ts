// server/src/services/musicbrainz.ts

import { db } from '../db/database.js'
import { fetchAlbumArtFromCAA } from './coverArtArchive.js'

import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const IMAGES_DIR = process.env.NODE_ENV === 'production'
  ? '/var/www/bemused-node/current/public/images'
  : path.resolve(__dirname, '../../../public/images')

const MB_BASE = 'https://musicbrainz.org/ws/2'
const USER_AGENT = 'Bemused/1.0 (https://patf.net)'
const RATE_LIMIT_MS = 1100 // slightly over 1s to be safe

let lastRequestTime = 0

async function rateLimitedFetch(url: string): Promise<any> {
  const now = Date.now()
  const wait = RATE_LIMIT_MS - (now - lastRequestTime)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastRequestTime = Date.now()

  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    }
  })

  if (!res.ok) throw new Error(`MusicBrainz API error: ${res.status} ${url}`)
  return res.json()
}

// ---- Album (release) lookup ----

export interface MBIDResult {
  mbid: string
  confidence: number
  status: 'auto_matched' | 'low_confidence' | 'not_found' | 'unmatched'
}

export async function lookupAlbumMBID(
  albumId: number,
  albumTitle: string,
  artistName: string,
  trackCount?: number,
  releaseYear?: string | null
): Promise<MBIDResult> {
  const query = encodeURIComponent(`artist:"${artistName}" AND release:"${albumTitle}"`)
  const url = `${MB_BASE}/release?query=${query}&limit=5&fmt=json`

  let data: any
  try {
    data = await rateLimitedFetch(url)
  } catch (err) {
    console.warn(`  ⚠️  MB lookup failed for album ${albumId}: ${(err as Error).message}`)
    return { mbid: '', confidence: 0, status: 'unmatched' }
  }

  const releases: any[] = data.releases ?? []
  if (releases.length === 0) {
    await updateAlbumMBID(albumId, null, 0, 'not_found')
    return { mbid: '', confidence: 0, status: 'not_found' }
  }

  // MB returns its own score 0-100; use it as our base
  const top = releases[0]
  let score = parseInt(top.score ?? '0')

  // Boost if track count matches
  if (trackCount && top['medium-list']?.[0]?.['track-count'] === trackCount) {
    score = Math.min(100, score + 5)
  }

  // Boost if release year matches
  if (releaseYear && top.date?.startsWith(releaseYear)) {
    score = Math.min(100, score + 5)
  }

  const confidence = score / 100
  let status: MBIDResult['status']

  if (score >= 80) {
    status = 'auto_matched'
  } else if (score >= 50) {
    status = 'low_confidence'
  } else {
    await updateAlbumMBID(albumId, null, confidence, 'not_found')
    return { mbid: '', confidence, status: 'not_found' }
  }

  await updateAlbumMBID(albumId, top.id, confidence, status)

  // Async image fetch from Cover Art Archive — non-blocking
  fetchAlbumArtFromCAA(albumId, top.id, IMAGES_DIR).catch(err => {
    console.warn(`  ⚠️  CAA image fetch failed post-MBID for album ${albumId}:`, err.message)
  })

  return { mbid: top.id, confidence, status }
}

async function updateAlbumMBID(
  albumId: number,
  mbid: string | null,
  confidence: number,
  status: string
): Promise<void> {
  await db
    .updateTable('albums')
    .set({ musicbrainz_id: mbid, mbid_confidence: confidence, mbid_status: status })
    .where('id', '=', albumId)
    .execute()
}

// ---- Artist lookup ----

export async function lookupArtistMBID(
  artistId: number,
  artistName: string
): Promise<MBIDResult> {
  const query = encodeURIComponent(`"${artistName}"`)
  const url = `${MB_BASE}/artist?query=${query}&limit=5&fmt=json`

  let data: any
  try {
    data = await rateLimitedFetch(url)
  } catch (err) {
    console.warn(`  ⚠️  MB lookup failed for artist ${artistId}: ${(err as Error).message}`)
    return { mbid: '', confidence: 0, status: 'unmatched' }
  }

  const artists: any[] = data.artists ?? []
  if (artists.length === 0) {
    await updateArtistMBID(artistId, null, 0, 'not_found')
    return { mbid: '', confidence: 0, status: 'not_found' }
  }

  const top = artists[0]
  const score = parseInt(top.score ?? '0')
  const confidence = score / 100

  let status: MBIDResult['status']
  if (score >= 80) {
    status = 'auto_matched'
  } else if (score >= 50) {
    status = 'low_confidence'
  } else {
    await updateArtistMBID(artistId, null, confidence, 'not_found')
    return { mbid: '', confidence, status: 'not_found' }
  }

  await updateArtistMBID(artistId, top.id, confidence, status)
  return { mbid: top.id, confidence, status }
}

async function updateArtistMBID(
  artistId: number,
  mbid: string | null,
  confidence: number,
  status: string
): Promise<void> {
  await db
    .updateTable('artists')
    .set({ musicbrainz_id: mbid, mbid_confidence: confidence, mbid_status: status })
    .where('id', '=', artistId)
    .execute()
}
