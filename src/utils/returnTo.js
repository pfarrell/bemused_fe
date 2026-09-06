// src/utils/returnTo.js
// The browser's URL parser folds a leading "\" into "/" and strips tab/CR/LF
// before parsing, so a naive `startsWith('/') && !startsWith('//')` check
// lets values like "/\evil.com" or "/\t/evil.com" escape to another origin
// once resolved against a bare origin (window.location.href here; the same
// risk applies server-side wherever return_to is resolved against a bare
// origin rather than a fixed path prefix — see server/src/utils/returnTo.ts,
// a deliberate line-for-line port of this function kept in sync with it).
// Resolving against a sentinel origin and re-deriving the path/query/hash
// closes that gap.
export function safeReturnTo(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return null;
  let url;
  try {
    url = new URL(value, 'http://returnto.invalid');
  } catch {
    return null;
  }
  if (url.origin !== 'http://returnto.invalid') return null;
  return url.pathname + url.search + url.hash;
}
