---
name: Node server structure
description: Layout and key files of the new Node.js backend in server/
type: project
---

The Node backend lives in `bemused-spa/server/`:

- `src/index.ts` — Hono app entry point, route wiring, error handler
- `src/db/database.ts` — Kysely DB instance + typed table interfaces, reads BEMUSED_DB env var
- `src/db/streamUrl.ts` — helper that returns correct stream base URL (localhost in dev, BEMUSED_PATH in prod)
- `src/services/wikipedia.ts` — Wikipedia fetch + in-memory cache, mirrors Ruby Info class
- `src/routes/artists.ts` — GET /artists/random, GET /artist/:id
- `src/routes/albums.ts` — GET /album/:id
- `src/routes/search.ts` — GET /search?q= (complex UNION SQL run via raw pg pool, not Kysely sql tag)
- `src/routes/streams.ts` — GET /stream/:id (range-request aware, proxies to BEMUSED_DEV in dev)
- `src/routes/logs.ts` — GET /log/:id
- `src/routes/playlists.ts` — /playlist/:id, /top, /newborns, /surprise

**Why search uses raw pg:** Kysely sql tag has issues with complex UNION queries containing DISTINCT ON + ORDER BY — uses a separate pg.Pool instance for just that query.

Dev: `npm run dev` (tsx watch, no build step)
Prod: `npm run build && node dist/index.js` managed by systemd
