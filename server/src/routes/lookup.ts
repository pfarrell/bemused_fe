import { Hono } from 'hono'
import { db } from '../db/database.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function bemusedPublicUrl(): string {
  return process.env.BEMUSED_PUBLIC_URL || 'http://localhost:5173'
}

const lookup = new Hono()

// GET /lookup/mbid/:mbid — type-agnostic MusicBrainz ID lookup against our own
// artists/albums tables. Public (no auth) so external sites like Overtone can
// resolve an MBID straight to a loadable bemused URL without knowing whether
// it's an artist or a release.
lookup.get('/mbid/:mbid', async (c) => {
  const mbid = c.req.param('mbid').toLowerCase()

  if (!UUID_RE.test(mbid)) {
    return c.json({ error: 'Not a valid MusicBrainz ID' }, 400)
  }

  const artist = await db
    .selectFrom('artists')
    .select(['id', 'name', 'musicbrainz_id'])
    .where('musicbrainz_id', '=', mbid)
    .executeTakeFirst()

  if (artist) {
    return c.json({
      type: 'artist' as const,
      id: artist.id,
      name: artist.name,
      musicbrainz_id: artist.musicbrainz_id,
      url: `${bemusedPublicUrl()}/artist/${artist.id}`,
    })
  }

  let album = await db
    .selectFrom('albums')
    .select(['id', 'title', 'artist_id', 'musicbrainz_id'])
    .where('musicbrainz_id', '=', mbid)
    .orderBy('id')
    .executeTakeFirst()

  if (!album) {
    album = await db
      .selectFrom('albums')
      .select(['id', 'title', 'artist_id', 'musicbrainz_id'])
      .where('release_group_musicbrainz_id', '=', mbid)
      .orderBy('id')
      .executeTakeFirst()
  }

  if (album) {
    return c.json({
      type: 'album' as const,
      id: album.id,
      title: album.title,
      artist_id: album.artist_id,
      musicbrainz_id: album.musicbrainz_id,
      url: `${bemusedPublicUrl()}/album/${album.id}`,
    })
  }

  return c.json({ error: 'Not found' }, 404)
})

// GET /lookup/mbids — bulk MBID enumeration. Public (no auth), same trust
// model as /lookup/mbid/:mbid. Lets external sites (Overtone) mirror the
// full set of resolvable MBIDs locally instead of one call per entity.
lookup.get('/mbids', async (c) => {
  const baseUrl = bemusedPublicUrl()
  const results: Array<{ type: 'artist' | 'album'; musicbrainz_id: string; url: string }> = []

  const artists = await db
    .selectFrom('artists')
    .select(['id', 'musicbrainz_id'])
    .where('musicbrainz_id', 'is not', null)
    .execute()

  for (const artist of artists) {
    results.push({
      type: 'artist',
      musicbrainz_id: artist.musicbrainz_id as string,
      url: `${baseUrl}/artist/${artist.id}`,
    })
  }

  const albums = await db
    .selectFrom('albums')
    .select(['id', 'musicbrainz_id', 'release_group_musicbrainz_id'])
    .where((eb) =>
      eb.or([
        eb('musicbrainz_id', 'is not', null),
        eb('release_group_musicbrainz_id', 'is not', null),
      ]),
    )
    .execute()

  for (const album of albums) {
    const url = `${baseUrl}/album/${album.id}`
    if (album.musicbrainz_id) {
      results.push({ type: 'album', musicbrainz_id: album.musicbrainz_id, url })
    }
    if (album.release_group_musicbrainz_id) {
      results.push({ type: 'album', musicbrainz_id: album.release_group_musicbrainz_id, url })
    }
  }

  return c.json(results)
})

export default lookup
