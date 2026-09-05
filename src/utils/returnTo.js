// src/utils/returnTo.js
// Same validation bemused's own backend applies to the Google OAuth
// return_to param (server/src/routes/auth.ts) — kept in sync deliberately.
export function safeReturnTo(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}
