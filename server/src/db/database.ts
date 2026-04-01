import { Kysely, PostgresDialect, Generated, ColumnType } from 'kysely'
import pg from 'pg'

// ---- Table interfaces ----

interface ArtistTable {
  id: Generated<number>
  name: string
  image_path: string | null
  wikipedia: string | null
  musicbrainz_id: string | null
  mbid_confidence: number | null
  mbid_status: string | null
  created_at: ColumnType<Date, string | undefined, never>
  updated_at: ColumnType<Date, string | undefined, string | Date>
}

interface AlbumTable {
  id: Generated<number>
  title: string
  artist_id: number
  release_year: string | null
  disc_number: number | null
  genre_id: number | null
  image_path: string | null
  wikipedia: string | null
  musicbrainz_id: string | null
  mbid_confidence: number | null
  mbid_status: string | null
  created_at: ColumnType<Date, string | undefined, never>
  updated_at: ColumnType<Date, string | undefined, string | Date>
}

interface TrackTable {
  id: Generated<number>
  title: string
  track_number: string | null
  release_year: string | null
  album_id: number
  artist_id: number | null
  media_file_id: number | null
  wikipedia: string | null
  duration_sec: number | null
  created_at: ColumnType<Date, string | undefined, never>
  updated_at: ColumnType<Date, string | undefined, string | Date>
}

interface MediaFileTable {
  id: Generated<number>
  discriminator: string | null
  imported_date: Date | null
  last_modified: Date | null
  absolute_path: string | null
  name: string | null
  file_type: string | null
  track_id: number | null
  file_missing: boolean | null
  file_hash: string | null
  created_at: Date | null
  updated_at: Date | null
}

interface PlaylistTable {
  id: Generated<number>
  name: string
  user_id: number | null
  auto_generated: boolean | null
  image_path: string | null
  created_at: ColumnType<Date, string | Date | undefined, never>
  updated_at: ColumnType<Date, string | Date | undefined, string | Date>
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
  created_at: ColumnType<Date, Date | string | undefined, never>
  updated_at: ColumnType<Date, Date | string | undefined, never> | null
  ip_address: string | null
  cookie: string | null
}

interface FavoriteTable {
  id: Generated<number>
  user_id: number
  target_id: number
  kind: string
  created_at: ColumnType<Date, never, never>
  updated_at: ColumnType<Date, never, never>
}

interface UploadQueueTable {
  id: Generated<number>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  artist_name: string | null
  artist_id: number | null
  album_name: string | null
  album_id: number | null
  genre: string | null
  track_pad: number | null
  file_path: string
  original_filename: string
  file_hash: string
  file_size: number | null
  album_art_path: string | null
  album_art_url: string | null
  track_id: number | null
  error_message: string | null
  created_at: ColumnType<Date, never, never>
  started_at: Date | null
  completed_at: Date | null
}

interface UserTable {
  id: Generated<number>
  username: string
  email: string | null
  password: string
  admin: boolean
  created_at: ColumnType<Date, never, never>
  updated_at: ColumnType<Date, never, string | Date>
}

interface UserPlaylistTable {
  id: Generated<number>
  user_id: number
  playlist_id: number
  role: string
  created_at: ColumnType<Date, string | Date | undefined, never>
}

interface ArtistAlbumTable {
  id: Generated<number>
  artist_id: number
  album_id: number
  role: 'primary' | 'compilation' | 'featured' | 'guest' | 'collaborator'
  order: number
  created_at: ColumnType<Date, string | Date | undefined, never>
}

interface ArtistRelationTable {
  id: Generated<number>
  artist_id: number
  related_artist_id: number
  kind: string
  created_at: ColumnType<Date, string | Date | undefined, never>
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
  upload_queue: UploadQueueTable
  users: UserTable
  user_playlists: UserPlaylistTable
  artist_albums: ArtistAlbumTable
  artist_relations: ArtistRelationTable
}

// ---- DB instance ----

const dialect = new PostgresDialect({
  pool: new pg.Pool({
    connectionString: process.env.BEMUSED_DB,
    max: 10,
  }),
})

export const db = new Kysely<Database>({ dialect })
