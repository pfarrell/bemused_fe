import { db } from '../db/database.js'
import { errorLogService } from './errorLogService.js'

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
  durationSec: number
): Promise<RecordingMBIDResult> {
  const apiKey = process.env.ACOUSTID_API_KEY
  if (!apiKey) throw new Error('ACOUSTID_API_KEY is not set')

  const url = `${ACOUSTID_BASE}?client=${apiKey}&meta=recordings&duration=${durationSec}&fingerprint=${encodeURIComponent(fingerprint)}&format=json`

  let data: any
  try {
    data = await rateLimitedFetch(url)
  } catch (err) {
    console.warn(`  ⚠️  AcoustID lookup failed for media_file ${mediaFileId}: ${(err as Error).message}`)
    errorLogService.record({ source: 'acoustid', message: (err as Error).message, context: `media_file ${mediaFileId}` })
    return { mbid: '', confidence: 0, status: 'unmatched' }
  }

  const results: any[] = data.results ?? []
  if (results.length === 0) {
    await updateRecordingMBID(mediaFileId, null, 0, 'not_found')
    return { mbid: '', confidence: 0, status: 'not_found' }
  }

  const top = results[0]
  const confidence = typeof top.score === 'number' ? top.score : 0
  const recordingId: string | undefined = top.recordings?.[0]?.id

  let status: RecordingMBIDResult['status']
  if (!recordingId) {
    await updateRecordingMBID(mediaFileId, null, confidence, 'not_found')
    return { mbid: '', confidence, status: 'not_found' }
  } else if (confidence >= 0.7) {
    status = 'auto_matched'
  } else if (confidence >= 0.4) {
    status = 'low_confidence'
  } else {
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
