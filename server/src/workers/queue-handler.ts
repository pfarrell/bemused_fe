#!/usr/bin/env node

/**
 * Upload Queue Worker for Bemused
 *
 * Processes pending uploads from the upload_queue table:
 * 1. Extracts ID3 tags from audio files
 * 2. Creates/finds Artist, Album, Track records
 * 3. Moves files to NAS location: $BEMUSED_UPLOAD_PATH/{artist}/{album}/{track}.mp3
 * 4. Creates MediaFile record with hash and links to track
 * 5. Updates queue status to completed/failed
 */

import { db } from '../db/database.js'
import fs from 'fs'
import path from 'path'
import { parseFile } from 'music-metadata'
import NodeID3 from 'node-id3'
import { lookupAlbumMBID } from '../services/musicbrainz.js'
import { fetchSimilarArtists } from '../services/lastfmSimilar.js'

const POLL_INTERVAL_MS = 5000 // Poll every 5 seconds
const UPLOAD_PATH = process.env.BEMUSED_UPLOAD_PATH

if (!UPLOAD_PATH) {
  console.error('❌ Error: BEMUSED_UPLOAD_PATH environment variable not set')
  process.exit(1)
}

// Helper: coalesce two values, preferring the first if non-empty
function coalesce(first: string | null | undefined, second: string | null | undefined): string {
  if (first && first.trim()) return first.trim()
  if (second && second.trim()) return second.trim()
  return 'no tag'
}

// Helper: safe strip
function safeStrip(val: string | null | undefined): string {
  return val?.trim() || 'not set'
}

// Helper: convert string to number or null
function numberOrNull(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return value
  if (!value) return null
  const parsed = parseInt(value.toString())
  return isNaN(parsed) ? null : parsed
}

// Helper: extract track number from ID3 tag (handles "5/12" format)
function extractTrackNumber(trackTag: string | null | undefined): number | null {
  if (!trackTag) return null
  const str = trackTag.toString()
  const match = str.match(/^(\d+)/)
  return match ? parseInt(match[1]) : null
}

// Helper: extract track number from filename (e.g., "01 Song.mp3" or "Track 05.mp3")
function extractTrackFromFilename(filename: string): number | null {
  const basename = path.basename(filename, path.extname(filename))

  // Try patterns like "01 Song", "01-Song", "01_Song"
  const leadingNumber = basename.match(/^(\d+)[\s\-_]/)
  if (leadingNumber) return parseInt(leadingNumber[1])

  // Try "Track 01" or "Track01"
  const trackWord = basename.match(/track\s*(\d+)/i)
  if (trackWord) return parseInt(trackWord[1])

  return null
}

// Helper: sanitize filename (remove problematic characters)
function sanitizeFilename(name: string): string {
  return name
    .replace(/\s*:/g, '') // Remove colons with optional spaces
    .replace(/[\(\)\?\"]/g, '') // Remove parens, quotes, question marks
    .trim()
}

// Main processing function
async function processQueueItem(item: any) {
  console.log(`\n🔄 Processing queue item ${item.id}: ${item.original_filename}`)

  try {
    // Update status to processing
    await db
      .updateTable('upload_queue')
      .set({ status: 'processing', started_at: new Date() })
      .where('id', '=', item.id)
      .execute()

    // Check if file exists
    if (!fs.existsSync(item.file_path)) {
      throw new Error(`File not found: ${item.file_path}`)
    }

    // Extract ID3 tags
    console.log('  📖 Reading ID3 tags...')
    const tags = NodeID3.read(item.file_path)
    const metadata = await parseFile(item.file_path)

    // Determine artist, album, and track info
    // Priority: manual input (ID or name) > ID3 tags > filename

    // If user provided artist_id, use it directly (don't look at names or tags)
    // Otherwise, use artist_name if provided, else fall back to ID3 tag
    let trackArtistId: number | null = null
    let albumArtistId: number | null = null
    let trackArtistName: string
    let albumArtistName: string

    if (item.artist_id) {
      // User provided an ID - use it for both track and album artist
      trackArtistId = item.artist_id
      albumArtistId = item.artist_id
      trackArtistName = '' // Will be looked up from database
      albumArtistName = ''
    } else if (item.artist_name) {
      // User provided a name - use it
      trackArtistName = item.artist_name
      albumArtistName = item.artist_name
    } else {
      // Fall back to ID3 tags
      trackArtistName = tags.artist || 'Unknown Artist'
      albumArtistName = tags.artist || 'Unknown Artist'
    }

    // Handle album similarly
    let albumId: number | null = null
    let albumName: string

    if (item.album_id) {
      albumId = item.album_id
      albumName = '' // Will be looked up
    } else if (item.album_name) {
      albumName = item.album_name
    } else {
      albumName = tags.album || 'Unknown Album'
    }

    const trackTitle = safeStrip(tags.title) !== 'not set'
      ? safeStrip(tags.title)
      : path.basename(item.file_path, path.extname(item.file_path))

    // Find or create track artist
    let trackArtist
    if (trackArtistId) {
      console.log(`  🎤 Using artist ID: ${trackArtistId}`)
      trackArtist = await db
        .selectFrom('artists')
        .selectAll()
        .where('id', '=', trackArtistId)
        .executeTakeFirst()

      if (!trackArtist) {
        throw new Error(`Artist ID ${trackArtistId} not found`)
      }
      console.log(`  🎤 Found artist: ${trackArtist.name}`)
    } else {
      console.log(`  🎤 Finding/creating artist: ${trackArtistName}`)
      // Find or create by name
      trackArtist = await db
        .selectFrom('artists')
        .selectAll()
        .where('name', '=', trackArtistName)
        .executeTakeFirst()

      if (!trackArtist) {
        trackArtist = await db
          .insertInto('artists')
          .values({ name: trackArtistName })
          .returningAll()
          .executeTakeFirst()

        if (trackArtist) {
          fetchSimilarArtists(trackArtist.id, trackArtist.name).catch(err =>
            console.warn(`  ⚠️  Similar artists lookup failed for "${trackArtistName}":`, err.message)
          )
        }
      }
    }

    // Find or create album artist (might be same as track artist)
    let albumArtist
    if (albumArtistId) {
      console.log(`  🎨 Using album artist ID: ${albumArtistId}`)
      albumArtist = await db
        .selectFrom('artists')
        .selectAll()
        .where('id', '=', albumArtistId)
        .executeTakeFirst()

      if (!albumArtist) {
        throw new Error(`Album artist ID ${albumArtistId} not found`)
      }
      console.log(`  🎨 Found album artist: ${albumArtist.name}`)
    } else {
      console.log(`  🎨 Finding/creating album artist: ${albumArtistName}`)
      albumArtist = await db
        .selectFrom('artists')
        .selectAll()
        .where('name', '=', albumArtistName)
        .executeTakeFirst()

      if (!albumArtist) {
        albumArtist = await db
          .insertInto('artists')
          .values({ name: albumArtistName })
          .returningAll()
          .executeTakeFirst()

        if (albumArtist) {
          fetchSimilarArtists(albumArtist.id, albumArtist.name).catch(err =>
            console.warn(`  ⚠️  Similar artists lookup failed for "${albumArtistName}":`, err.message)
          )
        }
      }
    }

    // Find or create album
    let album
    if (albumId) {
      console.log(`  💿 Using album ID: ${albumId}`)
      album = await db
        .selectFrom('albums')
        .selectAll()
        .where('id', '=', albumId)
        .executeTakeFirst()

      if (!album) {
        throw new Error(`Album ID ${albumId} not found`)
      }
      console.log(`  💿 Found album: ${album.title}`)
    } else {
      console.log(`  💿 Finding/creating album: ${albumName}`)
      album = await db
        .selectFrom('albums')
        .selectAll()
        .where('title', '=', albumName)
        .where('artist_id', '=', albumArtist!.id)
        .executeTakeFirst()

      if (!album) {
        const releaseYear = tags.year || metadata.common.year?.toString() || null
        album = await db
          .insertInto('albums')
          .values({
            title: albumName,
            artist_id: albumArtist!.id,
            release_year: releaseYear
          })
          .returningAll()
          .executeTakeFirst()
      }
    }

    // Async MBID lookup — non-blocking, upload success does not depend on it
    if (album) {
      const trackCountResult = await db
        .selectFrom('tracks')
        .select(db.fn.count<number>('id').as('count'))
        .where('album_id', '=', album.id)
        .executeTakeFirst()
      const trackCount = Number(trackCountResult?.count ?? 0)

      lookupAlbumMBID(
        album.id,
        album.title,
        albumArtist!.name,
        trackCount,
        album.release_year
      ).then(result => {
        if (result.status !== 'unmatched') {
          console.log(`  🎯 MBID assigned to album ${album!.id}: ${result.mbid} (${result.status})`)
        }
      }).catch(err => {
        console.warn(`  ⚠️  MBID lookup failed for album ${album!.id}:`, err.message)
      })
    }

    // Calculate track number: ID3 tag > filename > null
    let rawTrackNumber = extractTrackNumber(tags.trackNumber)
    if (rawTrackNumber === null) {
      rawTrackNumber = extractTrackFromFilename(item.original_filename)
    }

    const trackPad = item.track_pad || 0
    const trackNumber = rawTrackNumber !== null ? (rawTrackNumber + trackPad).toString() : null

    // Determine final file location on NAS
    const sanitizedArtist = sanitizeFilename(albumArtist!.name)
    const sanitizedAlbum = sanitizeFilename(album!.title)
    const filename = path.basename(item.file_path)
    const nasLocation = path.join(UPLOAD_PATH, sanitizedArtist, sanitizedAlbum, filename)

    console.log(`  📁 Moving file to: ${nasLocation}`)

    // Create directory if needed
    fs.mkdirSync(path.dirname(nasLocation), { recursive: true })

    // Copy file to NAS location (handles cross-device moves)
    fs.copyFileSync(item.file_path, nasLocation)

    // Delete original file after successful copy
    fs.unlinkSync(item.file_path)

    // Get duration from metadata
    const durationSec = metadata.format.duration ? Math.round(metadata.format.duration) : null

    // Create media_file record (file system info)
    console.log(`  💾 Creating media_file record...`)
    const now = new Date()
    const fileStats = fs.statSync(nasLocation)
    const mediaFile = await db
      .insertInto('media_files')
      .values({
        absolute_path: nasLocation,
        file_hash: item.file_hash,
        name: filename,
        file_type: path.extname(filename).toLowerCase(),
        imported_date: now,
        last_modified: fileStats.mtime, // File's actual modification time
        created_at: now,
        updated_at: now,
        file_missing: false
      })
      .returningAll()
      .executeTakeFirst()

    // Find or create track
    console.log(`  🎵 Finding/creating track: ${trackTitle}`)
    let track = await db
      .selectFrom('tracks')
      .selectAll()
      .where('title', '=', trackTitle)
      .where('album_id', '=', album!.id)
      .where('track_number', '=', trackNumber)
      .executeTakeFirst()

    if (!track) {
      track = await db
        .insertInto('tracks')
        .values({
          title: trackTitle,
          track_number: trackNumber,
          album_id: album!.id,
          artist_id: trackArtist!.id,
          media_file_id: mediaFile!.id,
          duration_sec: durationSec
        })
        .returningAll()
        .executeTakeFirst()
    } else {
      // Update existing track
      track = await db
        .updateTable('tracks')
        .set({
          media_file_id: mediaFile!.id,
          duration_sec: durationSec,
          track_number: trackNumber
        })
        .where('id', '=', track.id)
        .returningAll()
        .executeTakeFirst()
    }

    // Handle album art if provided
    if (item.album_art_url && item.album_art_path) {
      console.log(`  🖼️  Album art URL provided: ${item.album_art_url}`)
      // Note: Album art download would be handled separately
      // Could trigger similar logic to the existing downloadAlbumImage endpoint
    }

    // Mark as completed
    await db
      .updateTable('upload_queue')
      .set({
        status: 'completed',
        completed_at: new Date(),
        track_id: track!.id
      })
      .where('id', '=', item.id)
      .execute()

    console.log(`✅ Successfully processed: ${trackTitle} by ${trackArtist!.name}`)

  } catch (error: any) {
    console.error(`❌ Error processing queue item ${item.id}:`, error.message)

    // Mark as failed with error message
    await db
      .updateTable('upload_queue')
      .set({
        status: 'failed',
        completed_at: new Date(),
        error_message: error.message
      })
      .where('id', '=', item.id)
      .execute()
  }
}

// Main worker loop
async function worker() {
  console.log('🚀 Bemused Upload Queue Worker started')
  console.log(`📁 Upload path: ${UPLOAD_PATH}`)
  console.log(`⏱️  Poll interval: ${POLL_INTERVAL_MS}ms\n`)

  while (true) {
    try {
      // Get next pending item
      const item = await db
        .selectFrom('upload_queue')
        .selectAll()
        .where('status', '=', 'pending')
        .orderBy('created_at', 'asc')
        .limit(1)
        .executeTakeFirst()

      if (item) {
        await processQueueItem(item)
      } else {
        // No pending items, wait before polling again
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
      }

    } catch (error: any) {
      console.error('❌ Worker error:', error)
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    }
  }
}

// Start the worker
worker().catch(error => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})
