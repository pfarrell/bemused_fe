--
-- PostgreSQL database dump
--

\restrict 6BQ8ONWLwuWLpwBKqfHfAXm8AxMnmp7nlEIx9TPjjnGn7ceMWsCVcFyA0qOlXbn

-- Dumped from database version 14.15 (Ubuntu 14.15-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 17.9 (Ubuntu 17.9-0ubuntu0.25.10.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- Name: f_unaccent(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.f_unaccent(text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $_$
      BEGIN
        RETURN unaccent($1);
      END;
      $_$;


--
-- Name: sync_artist_albums_on_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_artist_albums_on_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO artist_albums (artist_id, album_id, role, "order", created_at)
  VALUES (NEW.artist_id, NEW.id, 'primary', 1, COALESCE(NEW.created_at, CURRENT_TIMESTAMP))
  ON CONFLICT (artist_id, album_id) DO UPDATE
    SET role = 'primary', "order" = 1;
  RETURN NEW;
END;
$$;


--
-- Name: sync_artist_albums_on_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_artist_albums_on_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  old_primary_id INTEGER;
  new_artist_existing_record RECORD;
BEGIN
  IF OLD.artist_id IS DISTINCT FROM NEW.artist_id THEN

    SELECT id INTO old_primary_id
    FROM artist_albums
    WHERE album_id = NEW.id AND role = 'primary'
    LIMIT 1;

    SELECT * INTO new_artist_existing_record
    FROM artist_albums
    WHERE artist_id = NEW.artist_id AND album_id = NEW.id;

    IF FOUND THEN
      UPDATE artist_albums
      SET role = 'primary', "order" = 1
      WHERE id = new_artist_existing_record.id;

      IF old_primary_id IS NOT NULL THEN
        DELETE FROM artist_albums WHERE id = old_primary_id;
      END IF;
    ELSE
      IF old_primary_id IS NOT NULL THEN
        UPDATE artist_albums
        SET artist_id = NEW.artist_id
        WHERE id = old_primary_id;
      ELSE
        INSERT INTO artist_albums (artist_id, album_id, role, "order", created_at)
        VALUES (NEW.artist_id, NEW.id, 'primary', 1, COALESCE(NEW.updated_at, CURRENT_TIMESTAMP));
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: albums_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.albums_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: albums; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.albums (
    id integer DEFAULT nextval('public.albums_id_seq'::regclass) NOT NULL,
    title character varying(510) DEFAULT NULL::character varying,
    release_year character varying(510) DEFAULT NULL::character varying,
    artist_id integer NOT NULL,
    disc_number integer,
    genre_id integer,
    image_path character varying(510) DEFAULT NULL::character varying,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    wikipedia text,
    musicbrainz_id character varying(36),
    mbid_confidence numeric(3,2),
    mbid_status character varying(20) DEFAULT 'unmatched'::character varying
);


--
-- Name: albums_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.albums_tags (
    id integer NOT NULL,
    album_id integer,
    tag_id integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: albums_tags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.albums_tags_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: albums_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.albums_tags_id_seq OWNED BY public.albums_tags.id;


--
-- Name: artist_albums; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artist_albums (
    id integer NOT NULL,
    artist_id integer NOT NULL,
    album_id integer NOT NULL,
    role character varying(50) DEFAULT 'primary'::character varying NOT NULL,
    "order" integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_artist_albums_role CHECK (((role)::text = ANY ((ARRAY['primary'::character varying, 'compilation'::character varying, 'featured'::character varying, 'guest'::character varying, 'collaborator'::character varying])::text[])))
);


--
-- Name: TABLE artist_albums; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.artist_albums IS 'Many-to-many relationship between artists and albums with role-based relationships';


--
-- Name: COLUMN artist_albums.artist_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.artist_albums.artist_id IS 'Artist ID reference';


--
-- Name: COLUMN artist_albums.album_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.artist_albums.album_id IS 'Album ID reference';


--
-- Name: COLUMN artist_albums.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.artist_albums.role IS 'Artist role: primary, compilation, featured, guest';


--
-- Name: COLUMN artist_albums."order"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.artist_albums."order" IS 'Display order for multiple artists on same album';


--
-- Name: artist_albums_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.artist_albums_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: artist_albums_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.artist_albums_id_seq OWNED BY public.artist_albums.id;


--
-- Name: artist_relations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artist_relations (
    id integer NOT NULL,
    artist_id integer NOT NULL,
    related_artist_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    kind character varying(50) DEFAULT 'related'::character varying NOT NULL,
    source character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    similarity numeric(5,4),
    CONSTRAINT artist_relations_check CHECK ((artist_id <> related_artist_id))
);


--
-- Name: artist_relations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.artist_relations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: artist_relations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.artist_relations_id_seq OWNED BY public.artist_relations.id;


--
-- Name: artists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.artists_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: artists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artists (
    id integer DEFAULT nextval('public.artists_id_seq'::regclass) NOT NULL,
    name character varying(510) DEFAULT NULL::character varying,
    image_path character varying(510) DEFAULT NULL::character varying,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    wikipedia text,
    musicbrainz_id character varying(36),
    mbid_confidence numeric(3,2),
    mbid_status character varying(20) DEFAULT 'unmatched'::character varying
);


--
-- Name: artists_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artists_tags (
    id integer NOT NULL,
    artist_id integer,
    tag_id integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: artists_tags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.artists_tags_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: artists_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.artists_tags_id_seq OWNED BY public.artists_tags.id;


--
-- Name: collection_albums; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_albums (
    id integer NOT NULL,
    collection_id integer NOT NULL,
    album_id integer NOT NULL,
    "order" integer
);


--
-- Name: collection_albums_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.collection_albums_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: collection_albums_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.collection_albums_id_seq OWNED BY public.collection_albums.id;


--
-- Name: collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collections (
    id integer NOT NULL,
    name character varying NOT NULL,
    user_id integer,
    image_path character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: collections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.collections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: collections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.collections_id_seq OWNED BY public.collections.id;


--
-- Name: external_lookups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_lookups (
    id integer NOT NULL,
    entity_type character varying(20) NOT NULL,
    entity_id integer NOT NULL,
    service character varying(30) NOT NULL,
    checked_at timestamp without time zone DEFAULT now() NOT NULL,
    result character varying(20)
);


--
-- Name: external_lookups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.external_lookups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: external_lookups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.external_lookups_id_seq OWNED BY public.external_lookups.id;


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorites (
    id integer NOT NULL,
    target_id integer,
    user_id integer,
    kind text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: favorites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.favorites_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: favorites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.favorites_id_seq OWNED BY public.favorites.id;


--
-- Name: genres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.genres (
    id bigint NOT NULL,
    name character varying(255) DEFAULT NULL::character varying,
    "genreId" character varying(255) DEFAULT NULL::character varying
);


--
-- Name: images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.images (
    id integer NOT NULL,
    album_id integer,
    artist_id integer,
    is_primary boolean DEFAULT false NOT NULL,
    source character varying(50) DEFAULT 'manual'::character varying NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    width integer,
    height integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT images_check CHECK ((((album_id IS NOT NULL) AND (artist_id IS NULL)) OR ((artist_id IS NOT NULL) AND (album_id IS NULL))))
);


--
-- Name: images_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.images_id_seq OWNED BY public.images.id;


--
-- Name: logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logs (
    id integer DEFAULT nextval('public.logs_id_seq'::regclass) NOT NULL,
    artist_id integer,
    album_id integer,
    track_id integer,
    action character varying(510) DEFAULT NULL::character varying,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    ip_address character varying(510) DEFAULT NULL::character varying,
    cookie character varying(510) DEFAULT NULL::character varying
);


--
-- Name: media_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.media_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: media_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_files (
    id integer DEFAULT nextval('public.media_files_id_seq'::regclass) NOT NULL,
    discriminator character varying(510) DEFAULT NULL::character varying,
    imported_date timestamp with time zone,
    last_modified timestamp with time zone,
    absolute_path character varying(2048) DEFAULT NULL::character varying,
    name character varying(510) DEFAULT NULL::character varying,
    file_type character varying(510) DEFAULT NULL::character varying,
    track_id integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    file_missing boolean,
    file_hash character varying(32),
    entity_id integer,
    entity_type character varying(50)
);


--
-- Name: opinions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opinions (
    id integer NOT NULL,
    user_id integer,
    track_id integer,
    positive integer,
    negative integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: opinions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.opinions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: opinions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.opinions_id_seq OWNED BY public.opinions.id;


--
-- Name: playlist_tracks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.playlist_tracks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: playlist_tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.playlist_tracks (
    id integer DEFAULT nextval('public.playlist_tracks_id_seq'::regclass) NOT NULL,
    playlist_id integer,
    track_id integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    "order" integer DEFAULT 1 NOT NULL
);


--
-- Name: playlists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.playlists_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: playlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.playlists (
    id integer DEFAULT nextval('public.playlists_id_seq'::regclass) NOT NULL,
    name character varying(510) DEFAULT NULL::character varying,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    image_path character varying(510) DEFAULT NULL::character varying,
    auto_generated boolean
);


--
-- Name: resumes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resumes (
    id integer NOT NULL,
    user_id text,
    location text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: resumes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.resumes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: resumes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.resumes_id_seq OWNED BY public.resumes.id;


--
-- Name: schema_info; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_info (
    version integer DEFAULT 0 NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying(255) NOT NULL,
    applied_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    id integer NOT NULL,
    name text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: tags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tags_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tags_id_seq OWNED BY public.tags.id;


--
-- Name: tags_tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags_tracks (
    id integer NOT NULL,
    track_id integer,
    tag_id integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: tags_tracks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tags_tracks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tags_tracks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tags_tracks_id_seq OWNED BY public.tags_tracks.id;


--
-- Name: tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tokens (
    id integer NOT NULL,
    user_id integer,
    token text,
    expires_at timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tokens_id_seq OWNED BY public.tokens.id;


--
-- Name: tracks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tracks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tracks (
    id integer DEFAULT nextval('public.tracks_id_seq'::regclass) NOT NULL,
    title character varying(510) DEFAULT NULL::character varying,
    track_number character varying(510) DEFAULT NULL::character varying,
    release_year character varying(510) DEFAULT NULL::character varying,
    album_id integer,
    artist_id integer,
    media_file_id integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    wikipedia text,
    duration_sec integer
);


--
-- Name: upload_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.upload_queue (
    id integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    artist_name character varying(255),
    artist_id integer,
    album_name character varying(255),
    album_id integer,
    genre character varying(100),
    track_pad integer DEFAULT 0,
    file_path character varying(500) NOT NULL,
    original_filename character varying(255) NOT NULL,
    file_hash character varying(32) NOT NULL,
    file_size bigint,
    album_art_path character varying(500),
    album_art_url text,
    track_id integer,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    CONSTRAINT valid_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: TABLE upload_queue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.upload_queue IS 'Queue for background processing of uploaded audio files';


--
-- Name: COLUMN upload_queue.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.upload_queue.status IS 'pending, processing, completed, or failed';


--
-- Name: COLUMN upload_queue.track_pad; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.upload_queue.track_pad IS 'Offset to add to track numbers (for multi-disc albums)';


--
-- Name: COLUMN upload_queue.file_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.upload_queue.file_hash IS 'MD5 hash for deduplication';


--
-- Name: upload_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.upload_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: upload_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.upload_queue_id_seq OWNED BY public.upload_queue.id;


--
-- Name: user_playlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_playlists (
    id integer NOT NULL,
    user_id integer NOT NULL,
    playlist_id integer NOT NULL,
    role character varying(50) DEFAULT 'owner'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE user_playlists; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_playlists IS 'Many-to-many relationship between users and playlists with role-based access';


--
-- Name: COLUMN user_playlists.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_playlists.user_id IS 'User ID reference';


--
-- Name: COLUMN user_playlists.playlist_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_playlists.playlist_id IS 'Playlist ID reference';


--
-- Name: COLUMN user_playlists.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_playlists.role IS 'User role for this playlist: owner, editor, viewer';


--
-- Name: user_playlists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_playlists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_playlists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_playlists_id_seq OWNED BY public.user_playlists.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text,
    email text,
    password text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    admin boolean DEFAULT false
);


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'User accounts for authentication and authorization';


--
-- Name: COLUMN users.username; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.username IS 'Unique username for login';


--
-- Name: COLUMN users.password; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.password IS 'BCrypt hashed password';


--
-- Name: COLUMN users.admin; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.admin IS 'Admin flag for accessing admin routes';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: albums_tags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.albums_tags ALTER COLUMN id SET DEFAULT nextval('public.albums_tags_id_seq'::regclass);


--
-- Name: artist_albums id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_albums ALTER COLUMN id SET DEFAULT nextval('public.artist_albums_id_seq'::regclass);


--
-- Name: artist_relations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_relations ALTER COLUMN id SET DEFAULT nextval('public.artist_relations_id_seq'::regclass);


--
-- Name: artists_tags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artists_tags ALTER COLUMN id SET DEFAULT nextval('public.artists_tags_id_seq'::regclass);


--
-- Name: collection_albums id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_albums ALTER COLUMN id SET DEFAULT nextval('public.collection_albums_id_seq'::regclass);


--
-- Name: collections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections ALTER COLUMN id SET DEFAULT nextval('public.collections_id_seq'::regclass);


--
-- Name: external_lookups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_lookups ALTER COLUMN id SET DEFAULT nextval('public.external_lookups_id_seq'::regclass);


--
-- Name: favorites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites ALTER COLUMN id SET DEFAULT nextval('public.favorites_id_seq'::regclass);


--
-- Name: images id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images ALTER COLUMN id SET DEFAULT nextval('public.images_id_seq'::regclass);


--
-- Name: opinions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opinions ALTER COLUMN id SET DEFAULT nextval('public.opinions_id_seq'::regclass);


--
-- Name: resumes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resumes ALTER COLUMN id SET DEFAULT nextval('public.resumes_id_seq'::regclass);


--
-- Name: tags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags ALTER COLUMN id SET DEFAULT nextval('public.tags_id_seq'::regclass);


--
-- Name: tags_tracks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags_tracks ALTER COLUMN id SET DEFAULT nextval('public.tags_tracks_id_seq'::regclass);


--
-- Name: tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tokens ALTER COLUMN id SET DEFAULT nextval('public.tokens_id_seq'::regclass);


--
-- Name: upload_queue id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_queue ALTER COLUMN id SET DEFAULT nextval('public.upload_queue_id_seq'::regclass);


--
-- Name: user_playlists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_playlists ALTER COLUMN id SET DEFAULT nextval('public.user_playlists_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: albums albums_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.albums
    ADD CONSTRAINT albums_pkey PRIMARY KEY (id);


--
-- Name: albums_tags albums_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.albums_tags
    ADD CONSTRAINT albums_tags_pkey PRIMARY KEY (id);


--
-- Name: artist_albums artist_albums_artist_id_album_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_albums
    ADD CONSTRAINT artist_albums_artist_id_album_id_key UNIQUE (artist_id, album_id);


--
-- Name: artist_albums artist_albums_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_albums
    ADD CONSTRAINT artist_albums_pkey PRIMARY KEY (id);


--
-- Name: artist_relations artist_relations_artist_id_related_artist_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_relations
    ADD CONSTRAINT artist_relations_artist_id_related_artist_id_key UNIQUE (artist_id, related_artist_id);


--
-- Name: artist_relations artist_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_relations
    ADD CONSTRAINT artist_relations_pkey PRIMARY KEY (id);


--
-- Name: artists artists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artists
    ADD CONSTRAINT artists_pkey PRIMARY KEY (id);


--
-- Name: artists_tags artists_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artists_tags
    ADD CONSTRAINT artists_tags_pkey PRIMARY KEY (id);


--
-- Name: collection_albums collection_albums_collection_id_album_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_albums
    ADD CONSTRAINT collection_albums_collection_id_album_id_key UNIQUE (collection_id, album_id);


--
-- Name: collection_albums collection_albums_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_albums
    ADD CONSTRAINT collection_albums_pkey PRIMARY KEY (id);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: external_lookups external_lookups_entity_type_entity_id_service_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_lookups
    ADD CONSTRAINT external_lookups_entity_type_entity_id_service_key UNIQUE (entity_type, entity_id, service);


--
-- Name: external_lookups external_lookups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_lookups
    ADD CONSTRAINT external_lookups_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);


--
-- Name: genres genres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT genres_pkey PRIMARY KEY (id);


--
-- Name: images images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_pkey PRIMARY KEY (id);


--
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- Name: media_files media_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_pkey PRIMARY KEY (id);


--
-- Name: opinions opinions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opinions
    ADD CONSTRAINT opinions_pkey PRIMARY KEY (id);


--
-- Name: playlist_tracks playlist_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_tracks
    ADD CONSTRAINT playlist_tracks_pkey PRIMARY KEY (id);


--
-- Name: playlists playlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlists
    ADD CONSTRAINT playlists_pkey PRIMARY KEY (id);


--
-- Name: resumes resumes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT resumes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: tags_tracks tags_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags_tracks
    ADD CONSTRAINT tags_tracks_pkey PRIMARY KEY (id);


--
-- Name: tokens tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tokens
    ADD CONSTRAINT tokens_pkey PRIMARY KEY (id);


--
-- Name: tracks tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracks
    ADD CONSTRAINT tracks_pkey PRIMARY KEY (id);


--
-- Name: upload_queue upload_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_queue
    ADD CONSTRAINT upload_queue_pkey PRIMARY KEY (id);


--
-- Name: user_playlists user_playlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_playlists
    ADD CONSTRAINT user_playlists_pkey PRIMARY KEY (id);


--
-- Name: user_playlists user_playlists_user_id_playlist_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_playlists
    ADD CONSTRAINT user_playlists_user_id_playlist_id_key UNIQUE (user_id, playlist_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: favorites_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX favorites_created_at_index ON public.favorites USING btree (created_at);


--
-- Name: favorites_user_id_kind_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX favorites_user_id_kind_index ON public.favorites USING btree (user_id, kind);


--
-- Name: idx_albums_mbid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_albums_mbid ON public.albums USING btree (musicbrainz_id) WHERE (musicbrainz_id IS NOT NULL);


--
-- Name: idx_albums_mbid_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_albums_mbid_status ON public.albums USING btree (mbid_status);


--
-- Name: idx_artist_albums_album_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artist_albums_album_order ON public.artist_albums USING btree (album_id, "order");


--
-- Name: idx_artist_albums_artist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artist_albums_artist_id ON public.artist_albums USING btree (artist_id);


--
-- Name: idx_artist_albums_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artist_albums_role ON public.artist_albums USING btree (role);


--
-- Name: idx_artist_relations_artist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artist_relations_artist_id ON public.artist_relations USING btree (artist_id);


--
-- Name: idx_artist_relations_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artist_relations_kind ON public.artist_relations USING btree (kind);


--
-- Name: idx_artist_relations_related_artist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artist_relations_related_artist_id ON public.artist_relations USING btree (related_artist_id);


--
-- Name: idx_artist_relations_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artist_relations_source ON public.artist_relations USING btree (source);


--
-- Name: idx_artists_mbid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artists_mbid ON public.artists USING btree (musicbrainz_id) WHERE (musicbrainz_id IS NOT NULL);


--
-- Name: idx_artists_mbid_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artists_mbid_status ON public.artists USING btree (mbid_status);


--
-- Name: idx_collection_albums_album_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_albums_album_id ON public.collection_albums USING btree (album_id);


--
-- Name: idx_collection_albums_collection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_albums_collection_id ON public.collection_albums USING btree (collection_id);


--
-- Name: idx_external_lookups_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_external_lookups_entity ON public.external_lookups USING btree (entity_type, entity_id);


--
-- Name: idx_images_album_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_images_album_id ON public.images USING btree (album_id) WHERE (album_id IS NOT NULL);


--
-- Name: idx_images_album_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_images_album_primary ON public.images USING btree (album_id, is_primary) WHERE ((is_primary = true) AND (album_id IS NOT NULL));


--
-- Name: idx_images_artist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_images_artist_id ON public.images USING btree (artist_id) WHERE (artist_id IS NOT NULL);


--
-- Name: idx_images_artist_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_images_artist_primary ON public.images USING btree (artist_id, is_primary) WHERE ((is_primary = true) AND (artist_id IS NOT NULL));


--
-- Name: idx_media_files_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_files_entity ON public.media_files USING btree (entity_type, entity_id);


--
-- Name: idx_media_files_file_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_files_file_hash ON public.media_files USING btree (file_hash);


--
-- Name: idx_trgm_unaccent_album_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trgm_unaccent_album_title ON public.albums USING btree (public.f_unaccent(lower((title)::text)));


--
-- Name: idx_trgm_unaccent_artist_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trgm_unaccent_artist_name ON public.artists USING btree (public.f_unaccent(lower((name)::text)));


--
-- Name: idx_trgm_unaccent_track_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trgm_unaccent_track_title ON public.tracks USING btree (public.f_unaccent(lower((title)::text)));


--
-- Name: idx_upload_queue_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upload_queue_created_at ON public.upload_queue USING btree (created_at);


--
-- Name: idx_upload_queue_file_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upload_queue_file_hash ON public.upload_queue USING btree (file_hash);


--
-- Name: idx_upload_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upload_queue_status ON public.upload_queue USING btree (status);


--
-- Name: idx_user_playlists_playlist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_playlists_playlist_id ON public.user_playlists USING btree (playlist_id);


--
-- Name: idx_user_playlists_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_playlists_role ON public.user_playlists USING btree (role);


--
-- Name: idx_user_playlists_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_playlists_user_id ON public.user_playlists USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: logs_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX logs_created_at_index ON public.logs USING btree (created_at);


--
-- Name: resumes_created_at_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX resumes_created_at_user_id_index ON public.resumes USING btree (created_at, user_id);


--
-- Name: albums trigger_sync_artist_albums_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_artist_albums_insert AFTER INSERT ON public.albums FOR EACH ROW EXECUTE FUNCTION public.sync_artist_albums_on_insert();


--
-- Name: albums trigger_sync_artist_albums_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_artist_albums_update AFTER UPDATE ON public.albums FOR EACH ROW EXECUTE FUNCTION public.sync_artist_albums_on_update();


--
-- Name: artist_albums artist_albums_album_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_albums
    ADD CONSTRAINT artist_albums_album_id_fkey FOREIGN KEY (album_id) REFERENCES public.albums(id) ON DELETE CASCADE;


--
-- Name: artist_albums artist_albums_artist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_albums
    ADD CONSTRAINT artist_albums_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES public.artists(id) ON DELETE CASCADE;


--
-- Name: artist_relations artist_relations_artist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_relations
    ADD CONSTRAINT artist_relations_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES public.artists(id) ON DELETE CASCADE;


--
-- Name: artist_relations artist_relations_related_artist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_relations
    ADD CONSTRAINT artist_relations_related_artist_id_fkey FOREIGN KEY (related_artist_id) REFERENCES public.artists(id) ON DELETE CASCADE;


--
-- Name: collection_albums collection_albums_album_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_albums
    ADD CONSTRAINT collection_albums_album_id_fkey FOREIGN KEY (album_id) REFERENCES public.albums(id) ON DELETE CASCADE;


--
-- Name: collection_albums collection_albums_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_albums
    ADD CONSTRAINT collection_albums_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;


--
-- Name: collections collections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: images images_album_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_album_id_fkey FOREIGN KEY (album_id) REFERENCES public.albums(id) ON DELETE CASCADE;


--
-- Name: images images_artist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES public.artists(id) ON DELETE CASCADE;


--
-- Name: upload_queue upload_queue_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_queue
    ADD CONSTRAINT upload_queue_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id);


--
-- Name: user_playlists user_playlists_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_playlists
    ADD CONSTRAINT user_playlists_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlists(id) ON DELETE CASCADE;


--
-- Name: user_playlists user_playlists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_playlists
    ADD CONSTRAINT user_playlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 6BQ8ONWLwuWLpwBKqfHfAXm8AxMnmp7nlEIx9TPjjnGn7ceMWsCVcFyA0qOlXbn

