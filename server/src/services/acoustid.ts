import { db } from '../db/database.js'
import { errorLogService } from './errorLogService.js'
import { titlesRoughlyMatch } from '../utils/titleMatch.js'

const ACOUSTID_BASE = 'https://api.acoustid.org/v2/lookup'
const RATE_LIMIT_MS = 350 // AcoustID's default key limit is ~3 req/s; stay under it

let nextAllowedTime = Date.now()

async function rateLimitedFetch(url: string): Promise<any> {
  const now = Date.now()
  const scheduledTime = Math.max(now, nextAllowedTime)
  nextAllowedTime = scheduledTime + RATE_LIMIT_MS
  const wait = scheduledTime - now
  if (wait > 0) await new Promise(r => setTimeout(r, wait))

  const res = await fetch(url)
  if (!res.ok) throw new Error(`AcoustID API error: ${res.status}`)
  return res.json()
}

export interface RecordingMBIDResult {
  mbid: string
  confidence: number
  status: 'auto_matched' | 'low_confidence' | 'not_found' | 'unmatched'
}

export async function lookupRecordingMBID(
  mediaFileId: number,
  fingerprint: string,
  durationSec: number,
  trackTitle?: string,
  artistName?: string,
  // Only pass this when the track's album already has a CONFIDENT
  // (auto_matched) musicbrainz_id — an unconfident/guessed album MBID
  // would make the "no matching release" case meaningless.
  albumMbid?: string
): Promise<RecordingMBIDResult> {
  const apiKey = process.env.ACOUSTID_API_KEY
  if (!apiKey) throw new Error('ACOUSTID_API_KEY is not set')

  // `releases` meta nests each candidate recording's known releases, which
  // is what makes the albumMbid cross-check below possible.
  const url = `${ACOUSTID_BASE}?client=${apiKey}&meta=recordings+releases&duration=${durationSec}&fingerprint=${encodeURIComponent(fingerprint)}&format=json`

  let data: any
  try {
    data = await rateLimitedFetch(url)
  } catch (err) {
    console.warn(`  ⚠️  AcoustID lookup failed for media_file ${mediaFileId}: ${(err as Error).message}`)
    errorLogService.record({ source: 'acoustid', message: (err as Error).message, context: `media_file ${mediaFileId}` })
    return { mbid: '', confidence: 0, status: 'unmatched' }
  }

  // AcoustID can return HTTP 200 with an in-body error (e.g. malformed
  // fingerprint, body-level rate limiting). Treat that exactly like the
  // HTTP-failure case above — do NOT write to the DB — so the row stays
  // retryable ('unmatched') instead of being permanently marked
  // 'not_found', which is terminal under the backfill script's default
  // filter.
  if (data && typeof data.status === 'string' && data.status !== 'ok') {
    const message = `AcoustID API returned error status: ${JSON.stringify(data.error ?? data.status)}`
    console.warn(`  ⚠️  AcoustID lookup failed for media_file ${mediaFileId}: ${message}`)
    errorLogService.record({ source: 'acoustid', message, context: `media_file ${mediaFileId}` })
    return { mbid: '', confidence: 0, status: 'unmatched' }
  }

  // Existing confidence, if this row was already resolved by a more
  // precise mechanism (e.g. the release-tracklist path in
  // recordingResolution.ts, which writes mbid_confidence: 1.0). A fresh
  // AcoustID result must never overwrite that with a null/worse answer —
  // there's no column marking which mechanism produced a match, so this
  // is the cheapest guard against --force (or --id, which implicitly
  // forces) clobbering an already-maximally-confident match.
  const existing = await db
    .selectFrom('media_files')
    .select(['musicbrainz_recording_id', 'mbid_confidence'])
    .where('id', '=', mediaFileId)
    .executeTakeFirst()
  // mbid_confidence is a `numeric(3,2)` column — pg/Kysely returns numeric
  // types as strings, not JS numbers, so this must be parsed rather than
  // compared with `===`.
  const alreadyMaxConfidence = existing?.mbid_confidence != null && Number(existing.mbid_confidence) === 1.0
  const unchangedResult = (): RecordingMBIDResult => ({
    mbid: existing?.musicbrainz_recording_id ?? '',
    confidence: 1.0,
    status: 'auto_matched',
  })

  const results: any[] = data.results ?? []
  if (results.length === 0) {
    if (alreadyMaxConfidence) return unchangedResult()
    await updateRecordingMBID(mediaFileId, null, 0, 'not_found')
    return { mbid: '', confidence: 0, status: 'not_found' }
  }

  const top = results[0]
  const confidence = typeof top.score === 'number' ? top.score : 0
  const recordingId: string | undefined = top.recordings?.[0]?.id
  const returnedTitle: string | undefined = top.recordings?.[0]?.title
  const returnedArtists: string[] = (top.recordings?.[0]?.artists ?? [])
    .map((a: any) => a?.name)
    .filter((name: unknown): name is string => typeof name === 'string')
  const returnedReleaseIds: string[] = (top.recordings?.[0]?.releases ?? [])
    .map((r: any) => r?.id)
    .filter((id: unknown): id is string => typeof id === 'string')

  let status: RecordingMBIDResult['status']
  if (!recordingId) {
    if (alreadyMaxConfidence) return unchangedResult()
    await updateRecordingMBID(mediaFileId, null, confidence, 'not_found')
    return { mbid: '', confidence, status: 'not_found' }
  } else if (confidence >= 0.7) {
    // AcoustID's own crowd-sourced fingerprint database can have a
    // recording MBID contaminated by mistagged submissions from other
    // users' software — this can hand back a high-confidence score for a
    // completely unrelated song (seen in production: several dozen
    // unrelated tracks all "matched" to the same MBID at 0.97+). Cross-
    // check whatever identity data we already have (from ID3/the DB)
    // against what AcoustID reports for the match before trusting it.
    //
    // albumMbid is the strongest signal available — if the track's album
    // is confidently known, whether the matched recording actually
    // belongs to a release on that album is decisive either way, and
    // overrides the fuzzier title/artist text comparison (which can both
    // false-negative on messy ID3 tagging and false-positive on generic
    // titles like "Track 04"). Absent that, fall back to requiring title
    // AND artist to roughly agree.
    const albumSignal: boolean | undefined = albumMbid
      ? (returnedReleaseIds.length > 0 ? returnedReleaseIds.includes(albumMbid) : undefined)
      : undefined

    const titleOk = !trackTitle || !returnedTitle || titlesRoughlyMatch(trackTitle, returnedTitle)
    const artistOk = !artistName || returnedArtists.length === 0 || returnedArtists.some(a => titlesRoughlyMatch(artistName, a))

    const identityOk = albumSignal !== undefined ? albumSignal : (titleOk && artistOk)

    status = identityOk ? 'auto_matched' : 'low_confidence'
  } else if (confidence >= 0.4) {
    status = 'low_confidence'
  } else {
    if (alreadyMaxConfidence) return unchangedResult()
    await updateRecordingMBID(mediaFileId, null, confidence, 'not_found')
    return { mbid: '', confidence, status: 'not_found' }
  }

  await updateRecordingMBID(mediaFileId, recordingId, confidence, status)
  return { mbid: recordingId, confidence, status }
}

async function updateRecordingMBID(
  mediaFileId: number,
  mbid: string | null,
  confidence: number,
  status: string
): Promise<void> {
  await db
    .updateTable('media_files')
    .set({ musicbrainz_recording_id: mbid, mbid_confidence: confidence, mbid_status: status, updated_at: new Date() })
    .where('id', '=', mediaFileId)
    .execute()
}
