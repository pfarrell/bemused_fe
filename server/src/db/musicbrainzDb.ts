import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'

// ---- Table interfaces ----
//
// Subset of the official MusicBrainz schema mirrored locally (see
// docs/superpowers/specs — MusicBrainz local mirror). Only the tables
// needed for artist/release MBID lookups and admin search are modeled
// here; the mirror has ~375 tables total, most unused by bemused.
// `track`/`recording`-to-release joins are intentionally NOT covered —
// the `track` table was not imported (too large relative to its single
// caller), so `getReleaseRecordings` continues to use the MusicBrainz
// web API.

interface MBArtistTable {
  id: number
  gid: string
  name: string
  sort_name: string
  comment: string
}

interface MBArtistCreditTable {
  id: number
  name: string
}

interface MBReleaseTable {
  id: number
  gid: string
  name: string
  artist_credit: number
  release_group: number
  comment: string
}

interface MBMediumTable {
  id: number
  release: number
  position: number
  track_count: number
}

interface MBReleaseGroupTable {
  id: number
  gid: string
  name: string
  artist_credit: number
}

interface MBReleaseCountryTable {
  release: number
  country: number
  date_year: number | null
  date_month: number | null
  date_day: number | null
}

interface MBReleaseUnknownCountryTable {
  release: number
  date_year: number | null
  date_month: number | null
  date_day: number | null
}

interface MusicbrainzMirrorDatabase {
  artist: MBArtistTable
  artist_credit: MBArtistCreditTable
  release: MBReleaseTable
  release_group: MBReleaseGroupTable
  release_country: MBReleaseCountryTable
  release_unknown_country: MBReleaseUnknownCountryTable
  medium: MBMediumTable
}

// ---- DB instance ----

const pool = new pg.Pool({
  connectionString: process.env.MUSICBRAINZ_DB,
  max: 5,
})

pool.on('error', (err) => {
  console.warn('⚠️  Idle MusicBrainz mirror connection terminated:', err.message)
})

const dialect = new PostgresDialect({ pool })

export const mbDb = new Kysely<MusicbrainzMirrorDatabase>({ dialect })
