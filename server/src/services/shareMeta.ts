export type ShareEntityType = 'album' | 'artist' | 'playlist'

export interface ShareEntity {
  type: ShareEntityType
  id: number
  title: string
  description: string
  imagePath: string | null
}

export interface ShareTags {
  title: string
  description: string
  imageUrl: string
  url: string
  siteName: string
}

const IMAGE_BASE = 'https://patf.net/images'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Artists live under /images/artists/<path>; albums AND playlists both reuse
// the album image context (Playlist.jsx renders playlist.image_path via
// apiService.getImageUrl(..., 'album_page') today) — see design Section 2.
function resolveImageUrl(entity: ShareEntity, fallback: string): string {
  if (!entity.imagePath) return fallback
  const folder = entity.type === 'artist' ? 'artists' : 'albums'
  return `${IMAGE_BASE}/${folder}/${encodeURIComponent(entity.imagePath)}`
}

export function buildShareTags(entity: ShareEntity, host: string, proto: string): ShareTags {
  const fallbackImage = `${proto}://${host}/pshare/app/icons/icon-512.png`

  return {
    title: escapeHtml(entity.title),
    description: escapeHtml(entity.description),
    imageUrl: escapeHtml(resolveImageUrl(entity, fallbackImage)),
    url: escapeHtml(`${proto}://${host}/pshare/app/${entity.type}/${entity.id}`),
    siteName: 'P·Share',
  }
}

export function injectMetaTags(html: string, tags: ShareTags): string {
  const metaBlock = `    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${tags.siteName}">
    <meta property="og:title" content="${tags.title}">
    <meta property="og:description" content="${tags.description}">
    <meta property="og:image" content="${tags.imageUrl}">
    <meta property="og:url" content="${tags.url}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${tags.title}">
    <meta name="twitter:description" content="${tags.description}">
    <meta name="twitter:image" content="${tags.imageUrl}">
  </head>`

  return html
    .replace(/<title>.*?<\/title>/, () => `<title>${tags.title} · P·Share</title>`)
    .replace('</head>', () => metaBlock)
}
