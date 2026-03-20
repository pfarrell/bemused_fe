// Wikipedia summary service with in-memory cache.
// Mirrors the Ruby Info class behaviour: fetches the first 4 sentences
// (or up to the first newline) from the Wikipedia API.

interface WikiSummary {
  summary: string
  url: string
}

const cache = new Map<string, WikiSummary | null>()

async function fetchWikipedia(title: string): Promise<WikiSummary | null> {
  const encoded = encodeURIComponent(title)
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'bemused-music-app/1.0' },
    })
    if (!res.ok) return null

    const data = await res.json() as any
    const raw: string = data.extract ?? ''
    if (!raw) return null

    let summary: string
    const newlineIdx = raw.indexOf('\n')
    if (newlineIdx !== -1) {
      summary = raw.slice(0, newlineIdx)
    } else {
      const sentences = raw.split('. ')
      summary = sentences.length > 4 ? sentences.slice(0, 4).join('. ') : raw
    }

    return { summary, url: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encoded}` }
  } catch {
    return null
  }
}

// Try a list of candidate titles in order, return first hit.
async function tryTitles(titles: string[]): Promise<WikiSummary | null> {
  for (const title of titles) {
    const key = title.toLowerCase()
    if (cache.has(key)) {
      const cached = cache.get(key)
      if (cached) return cached
      continue
    }
    const result = await fetchWikipedia(title)
    cache.set(key, result)
    if (result) return result
  }
  return null
}

// Mirror Ruby's wp_fix: replace & with "and", strip parens
function wpFix(name: string): string {
  return name.replace(/&/g, 'and').replace(/\s*\(.*?\)/g, '').trim()
}

// Candidate names for an artist: exact, fixed, "Name (band)", "Name (musician)"
function artistCandidates(name: string, wikipediaOverride?: string | null): string[] {
  if (wikipediaOverride) return [wikipediaOverride]
  const fixed = wpFix(name)
  return [fixed, `${fixed} (band)`, `${fixed} (musician)`, `${fixed} (singer)`]
}

// Candidate titles for an album: "Artist – Album", "Album (album)"
function albumCandidates(
  artistName: string,
  albumTitle: string,
  artistWikipedia?: string | null,
  albumWikipedia?: string | null
): string[] {
  if (albumWikipedia) return [albumWikipedia]
  const artist = artistWikipedia ? wpFix(artistWikipedia) : wpFix(artistName)
  const title = wpFix(albumTitle)
  return [`${title} (${artist} album)`, `${title} (album)`, title]
}

export async function getArtistSummary(
  name: string,
  wikipediaOverride?: string | null
): Promise<WikiSummary | null> {
  return tryTitles(artistCandidates(name, wikipediaOverride))
}

export async function getAlbumSummary(
  artistName: string,
  albumTitle: string,
  artistWikipedia?: string | null,
  albumWikipedia?: string | null
): Promise<WikiSummary | null> {
  return tryTitles(albumCandidates(artistName, albumTitle, artistWikipedia, albumWikipedia))
}
