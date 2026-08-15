# Server Dependencies

All dependencies are already installed. Run `npm install` in the `server/` directory to restore them after a fresh clone.

Key production dependencies and their purpose:

| Package | Purpose |
|---------|---------|
| `hono` + `@hono/node-server` | HTTP framework and Node.js adapter |
| `kysely` + `pg` | Type-safe SQL query builder + PostgreSQL driver |
| `jsonwebtoken` + `bcrypt` | JWT auth cookies + password hashing |
| `music-metadata` | Audio file duration and metadata extraction |
| `node-id3` | ID3 tag reading from MP3 files (used by upload worker) |
| `sharp` | Image resizing for artist/album art |
| `node-fetch` | HTTP client for external service calls (MusicBrainz, Last.fm, etc.) |
| `dotenv` | Load `.env` file into `process.env` |
| `tsx` | TypeScript execution for dev server and scripts |

## System binaries (not npm-installable)

These are OS-level packages `npm install` cannot provide — install them separately on any machine running the server (dev or prod).

| Binary | Purpose | Install (Debian/Ubuntu) |
|--------|---------|--------------------------|
| `fpcalc` | Chromaprint CLI — computes local audio fingerprints (`server/src/utils/chromaprint.ts`), used for cross-context duplicate detection and AcoustID recording-MBID lookups | `apt install libchromaprint-tools` |
