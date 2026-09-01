// Normalizes a pasted Wikipedia URL down to the bare slug the app already
// stores (e.g. "Some_Article" or "Some_Article#Section_Anchor" — see
// splitFragment in server/src/services/wikipedia.ts for the fragment
// convention). Anything that isn't a recognized wikipedia.org article URL
// is returned unchanged, since it's assumed to already be a slug.
const WIKI_URL_RE = /^https?:\/\/[a-z]{2,3}(?:\.m)?\.wikipedia\.org\/wiki\/(\S+)$/i;

export const parseWikipediaSlug = (raw) => {
  const trimmed = raw.trim();
  const match = trimmed.match(WIKI_URL_RE);
  if (!match) return trimmed;

  const [pathPart, ...fragmentParts] = match[1].split('#');
  const fragment = fragmentParts.join('#');
  const withoutQuery = pathPart.split('?')[0];
  const slug = fragment ? `${withoutQuery}#${fragment}` : withoutQuery;

  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
};
