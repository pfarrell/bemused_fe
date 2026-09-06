// Server-side port of src/utils/returnTo.js — kept deliberately identical.
// A naive `startsWith('/') && !startsWith('//')` check is not safe once a
// value is resolved against a bare origin (no path prefix): the URL parser
// folds a leading "\" into "/" and strips tab/CR/LF before parsing, so
// "/\evil.com" or "/\t/evil.com" would escape to another origin. This is
// exactly what google/callback below does when landing on an external
// return_to, so it needs the same hardened check the client uses.
export function safeReturnTo(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  let url: URL;
  try {
    url = new URL(value, "http://returnto.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "http://returnto.invalid") return null;
  return url.pathname + url.search + url.hash;
}
