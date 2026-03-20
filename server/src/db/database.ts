import { Kysely, PostgresDialect, Generated, ColumnType } from 'kysely'
import pg from 'pg'

// ---- Table interfaces ----

interface ArtistTable {
  id: Generated<number>
  name: string
  image_path: string | null
  wikipedia: string | null
  created_at: ColumnType<Date, never, never>
  updated_at: ColumnType<Date, never, never>
}

interface AlbumTable {
  id: Generated<number>
  title: string
  artist_id: number
  release_year: string | null
  image_path: string | null
  wikipedia: string | null
  created_at: ColumnType<Date, never, never>
  updated_at: ColumnType<Date, never, never>
}

interface TrackTable {
  id: Generated<number>
  title: string
  track_number: string | null
  album_id: number
  artist_id: number | null
  media_file_id: number | null
  duration_sec: number | null
  created_at: ColumnType<Date, never, never>
  updated_at: ColumnType<Date, never, never>
}

interface MediaFileTable {
  id: Generated<number>
  absolute_path: string
  duration_sec: number | null
}

interface PlaylistTable {
  id: Generated<number>
  name: string
  user_id: number | null
  auto_generated: boolean | null
  image_path: string | null
  created_at: ColumnType<Date, never, never>
  updated_at: ColumnType<Date, never, never>
}

interface PlaylistTrackTable {
  id: Generated<number>
  playlist_id: number
  track_id: number
  order: number | null
}

interface LogTable {
  id: Generated<number>
  track_id: number | null
  album_id: number | null
  artist_id: number | null
  action: string | null
  created_at: ColumnType<Date, never, never>
}

interface FavoriteTable {
  id: Generated<number>
  user_id: number
  target_id: number
  kind: string
  created_at: ColumnType<Date, never, never>
  updated_at: ColumnType<Date, never, never>
}

export interface Database {
  artists: ArtistTable
  albums: AlbumTable
  tracks: TrackTable
  media_files: MediaFileTable
  playlists: PlaylistTable
  playlist_tracks: PlaylistTrackTable
  logs: LogTable
  favorites: FavoriteTable
}

// ---- DB instance ----

const dialect = new PostgresDialect({
  pool: new pg.Pool({
    connectionString: process.env.BEMUSED_DB,
    max: 10,
  }),
})

export const db = new Kysely<Database>({ dialect })
