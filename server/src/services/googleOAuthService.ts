import { Google, generateState, generateCodeVerifier } from 'arctic'
import { db } from '../db/database.js'

const SCOPES = ['openid', 'email', 'profile']

// Lazy getter, not a module-scope `new Google(...)`: GOOGLE_REDIRECT_BASE
// isn't set in the build environment, and recall hit exactly this bug when
// it built its client eagerly at import time (see
// docs/superpowers/specs/2026-07-29-google-oauth-shared-client-design.md).
function googleClient(): Google {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectBase = process.env.GOOGLE_REDIRECT_BASE
  if (!clientId || !clientSecret || !redirectBase) {
    throw new Error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_BASE must all be set')
  }
  return new Google(clientId, clientSecret, `${redirectBase}/auth/google/callback`)
}

export interface PkceAuthorization {
  url: string
  state: string
  codeVerifier: string
}

export function createAuthorization(): PkceAuthorization {
  const state = generateState()
  const codeVerifier = generateCodeVerifier()
  const url = googleClient().createAuthorizationURL(state, codeVerifier, SCOPES).toString()
  return { url, state, codeVerifier }
}

export async function exchangeCode(code: string, codeVerifier: string): Promise<string> {
  const tokens = await googleClient().validateAuthorizationCode(code, codeVerifier)
  return tokens.accessToken()
}

export interface GoogleProfile {
  sub: string
  email: string
  email_verified: boolean
  name?: string
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`Google userinfo fetch failed: ${res.status}`)
  return res.json() as Promise<GoogleProfile>
}

// Same three-way (plus link-noop/link-conflict) decision recall's
// lib/oauth-decision.ts encodes. Pure and small — ported as-is, with
// number ids instead of recall's uuid strings.
export type OAuthDecision =
  | { kind: 'login'; userId: number }
  | { kind: 'signup' }
  | { kind: 'link'; userId: number }
  | { kind: 'link-noop' }
  | { kind: 'link-conflict' }

export function decideOAuthAction(sessionUserId: number | null, identityUserId: number | null): OAuthDecision {
  if (sessionUserId !== null) {
    if (identityUserId === null) return { kind: 'link', userId: sessionUserId }
    if (identityUserId === sessionUserId) return { kind: 'link-noop' }
    return { kind: 'link-conflict' }
  }
  if (identityUserId === null) return { kind: 'signup' }
  return { kind: 'login', userId: identityUserId }
}

export async function getIdentity(provider: string, providerUserId: string) {
  return db
    .selectFrom('oauth_identities')
    .selectAll()
    .where('provider', '=', provider)
    .where('provider_user_id', '=', providerUserId)
    .executeTakeFirst()
}

export async function getIdentityForUser(userId: number, provider: string) {
  return db
    .selectFrom('oauth_identities')
    .selectAll()
    .where('user_id', '=', userId)
    .where('provider', '=', provider)
    .executeTakeFirst()
}

export async function createIdentity(params: { provider: string; providerUserId: string; userId: number; email: string }) {
  await db
    .insertInto('oauth_identities')
    .values({
      provider: params.provider,
      provider_user_id: params.providerUserId,
      user_id: params.userId,
      email: params.email,
    })
    .execute()
}

export async function deleteIdentity(userId: number, provider: string) {
  await db
    .deleteFrom('oauth_identities')
    .where('user_id', '=', userId)
    .where('provider', '=', provider)
    .execute()
}
