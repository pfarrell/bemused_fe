// src/utils/returnTo.js
// The client is deliberately stricter than the server's equivalent check
// (server/src/routes/auth.ts): the server is safe with a plain string-prefix
// check because it concatenates the value after a fixed path prefix, but here
// the value is assigned directly to window.location.href, and the browser's
// URL parser folds a leading "\" into "/" and strips tab/CR/LF before parsing
// -- so a naive `startsWith('/') && !startsWith('//')` check lets values like
// "/\evil.com" or "/\t/evil.com" escape to another origin. Resolving against
// a sentinel origin and re-deriving the path/query/hash closes that gap.
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
