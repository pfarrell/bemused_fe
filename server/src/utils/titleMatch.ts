// Loose title comparison shared by every recording-MBID resolution path
// (release-tracklist matching in recordingResolution.ts, AcoustID matching
// in acoustid.ts). Strips parenthetical suffixes (e.g. "(Radio Edit)") and
// punctuation before comparing, and allows either side to be a substring of
// the other so things like "Poison arrow" / "Poison Arrow" still match.
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function titlesRoughlyMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}
