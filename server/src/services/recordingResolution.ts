// server/src/services/recordingResolution.ts
//
// Resolves media_files.musicbrainz_recording_id for a freshly uploaded
// track. Two paths, cheapest/most-precise first:
//   1. If the track's album already has a confident (auto_matched)
//      release MBID, fetch that release's tracklist from MusicBrainz
//      (one call, no AcoustID) and match this track to a recording by
//      its position within a SINGLE-MEDIUM release.
//   2. Otherwise (no confident album MBID, multi-disc, or no position
//      match), fall back to AcoustID fingerprint lookup.
// The fingerprint is always computed and stored regardless of which path
// resolves the MBID — it's the cross-context duplicate-detection key,
// independent of whether/how the MBID got resolved.

import { db } from '../db/database.js'
import { getReleaseRecordings } from './musicbrainz.js'
import { lookupRecordingMBID } from './acoustid.js'
import { computeFingerprint } from '../utils/chromaprint.js'
import { errorLogService } from './errorLogService.js'

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function titlesRoughlyMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

interface AlbumForResolution {
  id: number
  musicbrainz_id: string | null
  mbid_status: string | null
}

export async function resolveRecordingMbid(
  mediaFileId: number,
  absolutePath: string,
  trackTitle: string,
  rawTrackNumber: number | null,
  album: AlbumForResolution
): Promise<void> {
  try {
    let resolvedViaRelease = false

    // Always fingerprint locally first, regardless of which path (or
    // neither) resolves the MBID below. This must happen before the
    // release-tracklist lookup: that lookup can throw (MusicBrainz 503s
    // under load are routine, via rateLimitedFetch), which would otherwise
    // skip fingerprinting entirely and leave the row permanently unretried
    // (queue-handler.ts only re-attempts rows with no fingerprint yet).
    const fp = await computeFingerprint(absolutePath)
    await db
      .updateTable('media_files')
      .set({ chromaprint_fingerprint: fp.fingerprint, chromaprint_duration_sec: Math.round(fp.duration), updated_at: new Date() })
      .where('id', '=', mediaFileId)
      .execute()

    if (album.musicbrainz_id && album.mbid_status === 'auto_matched' && rawTrackNumber !== null) {
      const releaseTracks = await getReleaseRecordings(album.musicbrainz_id)

      if (releaseTracks.length > 0) {
        const singleMedium = releaseTracks.every(t => t.discNumber === releaseTracks[0].discNumber)

        if (singleMedium) {
          const candidate = releaseTracks.find(t => t.position === rawTrackNumber)

          if (candidate && titlesRoughlyMatch(candidate.recordingTitle, trackTitle)) {
            await db
              .updateTable('media_files')
              .set({
                musicbrainz_recording_id: candidate.recordingId,
                mbid_confidence: 1.0,
                mbid_status: 'auto_matched',
                updated_at: new Date(),
              })
              .where('id', '=', mediaFileId)
              .execute()
            console.log(`  🎯 Recording MBID assigned to media_file ${mediaFileId} via release tracklist: ${candidate.recordingId}`)
            resolvedViaRelease = true
          }
        }
      }
    }

    if (!resolvedViaRelease) {
      await lookupRecordingMBID(mediaFileId, fp.fingerprint, Math.round(fp.duration))
    }
  } catch (err) {
    console.warn(`  ⚠️  Recording MBID resolution failed for media_file ${mediaFileId}:`, (err as Error).message)
    errorLogService.record({ source: 'recording-mbid', message: (err as Error).message, context: `media_file ${mediaFileId}` })
  }
}
