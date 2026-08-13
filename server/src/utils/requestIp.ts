import type { Context } from 'hono'

export function extractIpAddress(c: Context): string | null {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    c.req.header('x-real-ip') ||
    c.req.header('cf-connecting-ip') ||
    null
  )
}
