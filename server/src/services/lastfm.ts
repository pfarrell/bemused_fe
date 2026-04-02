// server/src/services/lastfm.ts
// Last.fm API client
// Note: artist image API is deprecated — images are no longer served.
// Useful endpoints: artist.getSimilar, track.getInfo, track.getCorrection

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0'

function apiKey(): string | undefined {
  return process.env.LASTFM_API_KEY
}

export function lastfmUrl(params: Record<string, string>): string {
  const key = apiKey()
  if (!key) throw new Error('LASTFM_API_KEY not set')
  const query = new URLSearchParams({ ...params, api_key: key, format: 'json' })
  return `${LASTFM_BASE}/?${query}`
}
