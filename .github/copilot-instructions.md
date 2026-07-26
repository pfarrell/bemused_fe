# Copilot Agent Instructions for bemused_fe

Trust these instructions. Only search the repo if information here is incomplete or incorrect.

## Project Summary

**bemused_fe** is a personal music streaming service called "P·Share". This is a monorepo with two independent packages:

1. **Frontend (root `/`)** — React 19 SPA built with Vite 6, using Zustand for state management. Written in JavaScript (`.js`/`.jsx`). Tailwind is installed (`tailwind.config.js` exists) but is **not actually wired into the build** — no `postcss.config.js` and no Tailwind Vite/PostCSS plugin, so the `@tailwind` directives in `src/index.css` pass through unprocessed. Styling is effectively hand-written custom CSS in `src/index.css`.
2. **Backend (`server/`)** — Hono-based Node.js API server written in TypeScript, using Kysely ORM with PostgreSQL, with a background queue worker.

Frontend has Vitest + React Testing Library tests (`npm test` from root, files live alongside source as `*.test.js`/`*.test.jsx`). Backend has no tests yet. CI runs on GitHub Actions (`.github/workflows/ci.yml`): frontend lint + test, then a backend TypeScript build check, on push to `main` and on pull requests.

## Build & Validate

### Frontend (run from repo root `/`)

```bash
npm install          # Always run before build or lint
npm run build        # Production build → outputs to dist/
npm run lint         # ESLint (flat config, JS/JSX only)
npm test             # Vitest run (unit/component tests)
npm run dev          # Dev server on localhost:5173, proxies /api → localhost:3000
```

- Always run `npm install` before `npm run build` or `npm run lint`.
- `npm run build` sets `base` to `/bemused/app/` in production mode. In dev, base is `/`.
- `npm run lint` uses ESLint 9 flat config (`eslint.config.js`). Linting covers `**/*.{js,jsx}` and ignores `dist/`. The `no-unused-vars` rule ignores variables starting with uppercase or `_`.
- Validation: after any change, always run `npm run lint`, `npm test`, and `npm run build` to confirm no errors.

### Backend (run from `server/`)

```bash
cd server
npm install          # Always run before build
npm run build        # TypeScript compile → dist/
npm run dev          # Dev server via tsx watch on src/index.ts
```

- The server requires a `.env` file (see `server/.env.example` for required vars including `BEMUSED_DB` PostgreSQL connection string).
- `npm run build` runs `tsc`. Check `server/tsconfig.json` for compiler options.

## Architecture & Key Files

### Frontend (root)

| Path | Purpose |
|---|---|
| `src/main.jsx` | Entry point, renders `<App />` |
| `src/App.jsx` | Router config. All routes render inside `Layout`. Basename: `/` (dev) or `/bemused/app` (prod) via `import.meta.env.DEV`. Routes: `/`, `/search`, `/login`, `/signup`, `/artist/:id`, `/album/:id`, `/library`, `/playlists`, `/playlist/:id`, `/collections`, `/collection/:id`, `/tags/:name`. Admin routes (require admin): `/admin/artist/:id`, `/admin/album/:id`, `/admin/collection/:id`, `/admin/playlist/:id`, `/admin/upload`, `/admin/logs`, `/admin/new` |
| `src/components/Layout.jsx` | Fixed header (SearchBar, tag filter, hamburger menu), scrollable main content with pull-to-refresh; fixed footer (NowPlaying + player) is rendered in `App.jsx` outside `<Routes>` so the player never unmounts on navigation |
| `src/components/NowPlaying.jsx` | Now-playing display in footer |
| `src/components/Track.jsx` | Track row component. Props: `{ track, index, trackCount, includeMeta, isPlaying }` |
| `src/components/player/` | `MusicPlayerWrapper.jsx` (renders both `<audio>` elements + transport controls from `playerStore` via `usePlayerEngine`), `PlaylistDrawer.jsx` (slide-out queue, drag-reorder on desktop, touch handling on mobile) |
| `src/components/SearchBar.jsx` | Header search |
| `src/components/ArtistGrid.jsx` | Grid layout for artists |
| `src/components/AlbumCard.jsx`, `AlbumGrid.jsx` | Album display components |
| `src/pages/Home.jsx` | Landing page — random artists |
| `src/pages/Artist.jsx` | `/artist/:id` — artist detail with albums |
| `src/pages/Album.jsx` | `/album/:id` — album detail with tracks |
| `src/pages/Search.jsx` | `/search?q=...` — search results |
| `src/pages/Login.jsx`, `Signup.jsx` | Auth pages |
| `src/pages/Library.jsx` | `/library` — user's personal library |
| `src/pages/Playlists.jsx`, `Playlist.jsx` | `/playlists`, `/playlist/:id` — playlist list and detail |
| `src/pages/Collections.jsx`, `Collection.jsx` | `/collections`, `/collection/:id` — collection list and detail |
| `src/pages/TagPage.jsx` | `/tags/:name` — browse artists and albums by tag |
| `src/pages/AdminArtist.jsx`, `AdminAlbum.jsx` | Edit metadata, manage images and artist relations (admin) |
| `src/pages/AdminCollection.jsx`, `AdminPlaylist.jsx` | Edit collection or playlist contents (admin) |
| `src/pages/AdminUpload.jsx` | Upload audio files; polls upload queue status (admin) |
| `src/pages/AdminLogs.jsx` | Paginated playback log viewer (admin) |
| `src/pages/AdminNew.jsx` | Create new artist or album records (admin) |
| `src/services/api.js` | Single axios instance. All API calls go through here. `apiService.getImageUrl(imagePath, context)` maps images to `https://patf.net/images/` (prod) or `/images` (dev). Context strings: `artist_search`, `artist_page`, `album_small`, `album_page`. `apiService.log(id)` fires at the 5-second mark of each track |
| `src/stores/playerStore.js` | Zustand store: single source of truth for playback state and transport logic (play/pause/seek/queue). Drives two `<audio>` elements (`audioElementA`/`audioElementB`, tracked by `activeSlot`) for gapless playback — the standby element is pre-loaded with the next track near the end of the current one. Key state: `currentTrack`, `playlist`, `isPlaying`, `currentTrackIndex`, `nextTrackIndex`, `shuffle` |
| `src/stores/authStore.js` | Zustand store: `user`, `isAuthenticated`, `isAdmin`. Auth uses httpOnly cookie (no localStorage token). On login/init, populates `tagFilterStore` from `user.default_tag` |
| `src/stores/homeModeStore.js` | Home page display mode (`'artists'` \| `'albums'`), persisted to `localStorage` as `home-mode` |
| `src/stores/tagFilterStore.js` | Active tag filter, persisted to `localStorage` as `tag-filter`; populated from `user.default_tag` on login |
| `src/components/ProtectedRoute.jsx` | Redirects to `/login` if not authenticated; `requireAdmin` prop also enforces admin role |
| `src/hooks/useInfiniteItems.js` | Infinite scroll hook |
| `src/hooks/usePlayerEngine.js` | Only code that touches the real `<audio>` DOM elements — binds both into `playerStore`, bridges DOM events to store actions, drives prefetch/gapless handoff and the Media Session API |
| `src/utils/formatters.js` | Formatting helpers |
| `src/index.css` | All custom CSS classes (`.app-header`, `.main-content`, `.app-footer`, `.artist-grid`, `.track-item`, `.now-playing`, etc.). Contains unprocessed `@tailwind` directives (see note above — Tailwind isn't actually wired in) |
| `public/` | Static assets (icons, images, favicon, PWA manifest assets). No external player script — the player is native code under `src/` |

### Backend (server/)

| Path | Purpose |
|---|---|
| `server/src/index.ts` | Hono server entry point |
| `server/src/routes/` | API route handlers |
| `server/src/services/` | Business logic |
| `server/src/db/` | Kysely database setup and queries |
| `server/src/middleware/` | Auth and other middleware |
| `server/src/workers/` | Background queue worker |
| `server/src/types.ts` | Shared TypeScript types |
| `server/migrations/` | Database migrations (SQL) |
| `server/schema.sql` | Full database schema dump |
| `server/tsconfig.json` | TypeScript config |

### Config Files (root)

| File | Purpose |
|---|---|
| `vite.config.js` | Vite config — proxy `/api` → `localhost:3000`, prod base `/bemused/app/` |
| `eslint.config.js` | ESLint 9 flat config with react-hooks and react-refresh plugins |
| `tailwind.config.js` | Tailwind content paths: `index.html` + `src/**/*.{js,ts,jsx,tsx}` |
| `index.html` | SPA entry HTML |
| `package.json` | Frontend deps and scripts |

## Key Conventions

- **No TypeScript in frontend** — all frontend code is `.js`/`.jsx`. Do not add `.ts`/`.tsx` files to `src/`.
- **Tailwind is not actually active** — despite `tailwind.config.js` and `@tailwind` directives in `src/index.css`, there's no PostCSS/Vite plugin wiring it up, so utility classes and preflight don't run. Treat styling as plain custom CSS in `src/index.css`; don't assume `box-sizing: border-box` is applied anywhere it isn't set explicitly.
- **Zustand** for state — no Redux, no Context API for global state.
- **axios** for HTTP — use the shared instance from `src/services/api.js`, not raw `fetch`. Base URL is `/api` (dev) or `/bemused/api` (prod). `withCredentials: true` for httpOnly cookie auth.
- **React Router v7** — routes defined in `src/App.jsx`.
- **Audio player is native, not external** — no `player.js` or `window.AudioPlayer`. `playerStore` (Zustand) owns all playback state and transport logic, driving two `<audio>` elements directly for gapless playback; `usePlayerEngine` is the only code that touches the DOM audio elements.
- **Image URLs** — always use `apiService.getImageUrl(path, context)` to construct image URLs. Context strings: `artist_image`, `album_art`, etc.
- **Tests** — frontend: Vitest + React Testing Library, run with `npm test` from root. Backend: no tests yet.
- **CI** — GitHub Actions (`.github/workflows/ci.yml`) runs frontend lint + test and a backend TypeScript build check on push to `main` and on PRs.
