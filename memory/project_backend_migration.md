---
name: Backend migration to Node.js/Hono
description: Active project to replace Ruby/Sinatra backend with Node.js/Hono + Kysely
type: project
---

Replacing the Ruby/Sinatra/Sequel backend with a Node.js backend using Hono (web framework) + Kysely (query builder) + pg.

**Why:** Modernize the stack, remove Ruby dependency, keep the React SPA frontend as-is.

**How to apply:** New backend lives in `server/` subdirectory of bemused-spa repo. It is working and tested locally. Next steps are deployment to production.

Key decisions made:
- Hono (not Next.js) — Sinatra-like, lightweight, good streaming support
- Kysely — type-safe query builder similar to Ruby's Sequel ORM
- TypeScript with strict mode OFF
- systemd for process management in production (not PM2)
- nginx serves static files directly; proxies API to Node on port 3000
- BEMUSED_PATH env var = full base URL for stream links (empty in dev, https://patf.com/bemused in prod)
- BEMUSED_DEV env var = proxy target for streams when NAS unavailable locally
- server/.env is gitignored; server/.env.example is committed
