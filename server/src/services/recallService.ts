// server/src/services/recallService.ts
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.BEMUSED_JWT_SECRET || 'default-secret-change-me'
const RECALL_BASE_URL = process.env.RECALL_API_URL || 'https://patf.com/recall'
const STATE_EXPIRES_IN = '10m'

function encryptionKey(): Buffer {
  const hex = process.env.RECALL_TOKEN_ENCRYPTION_KEY
  if (!hex) throw new Error('RECALL_TOKEN_ENCRYPTION_KEY not set')
  const key = Buffer.from(hex, 'hex')
  if (key.length !== 32) throw new Error('RECALL_TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
  return key
}

// Stored format: iv:authTag:ciphertext, all hex — AES-256-GCM.
export function encryptRecallToken(raw: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`
}

export function decryptRecallToken(stored: string): string {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(':')
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()])
  return plaintext.toString('utf8')
}

interface RecallStatePayload {
  userId: number
  returnTo: string
}

// returnTo travels inside the signed state because Recall's cli-auth callback
// URL construction (`${callback}?token=...&state=...`) always uses a literal
// `?`, so extra query params on our callback URL would produce a malformed
// URL if the callback itself already has a query string.
export function signRecallState(userId: number, returnTo: string): string {
  const payload: RecallStatePayload = { userId, returnTo }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: STATE_EXPIRES_IN, audience: 'recall-state' })
}

export function verifyRecallState(state: string): RecallStatePayload {
  return jwt.verify(state, JWT_SECRET, { audience: 'recall-state', algorithms: ['HS256'] }) as RecallStatePayload
}

export function recallAuthUrl(callbackUrl: string, state: string): string {
  const params = new URLSearchParams({ callback: callbackUrl, state, machine: 'bemused' })
  return `${RECALL_BASE_URL}/cli-auth?${params}`
}

export const BACKLINK_SENTINEL = '<!-- bemused-backlink -->'

function bemusedPublicUrl(): string {
  const url = process.env.BEMUSED_PUBLIC_URL
  if (!url) throw new Error('BEMUSED_PUBLIC_URL not set')
  return url
}

// Appended to content before it's sent to Recall — visible and clickable in
// Recall's own UI/search, but always stripped by stripBacklink() before
// bemused renders the note back on the album page.
// path is a full relative path from BEMUSED_PUBLIC_URL, e.g. "/album/123" or
// "/collection/45" — callers build the entity-appropriate path themselves,
// since not every entity kind has its own detail page (see tracks.ts).
export function appendBacklink(content: string, path: string): string {
  return `${content}\n\n${BACKLINK_SENTINEL}\n[Originally written in bemused](${bemusedPublicUrl()}${path})`
}

export function stripBacklink(content: string): string {
  const idx = content.indexOf(BACKLINK_SENTINEL)
  if (idx === -1) return content
  return content.slice(0, idx).replace(/\r?\n\s*\r?\n?$/, '')
}

interface RecallItem {
  id: string
  title: string | null
  contentText: string | null
}

export async function createRecallNote(
  token: string,
  params: { title: string; contentText: string; tags: string[] }
): Promise<RecallItem> {
  const res = await fetch(`${RECALL_BASE_URL}/api/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      type: 'note',
      title: params.title,
      contentText: params.contentText,
      tags: params.tags,
    }),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`Recall item creation failed: ${res.status}`)
  const body = await res.json()
  return body.item
}

export async function getRecallItem(token: string, itemId: string): Promise<RecallItem | null> {
  const res = await fetch(`${RECALL_BASE_URL}/api/items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Recall item fetch failed: ${res.status}`)
  const body = await res.json()
  return body.item
}
