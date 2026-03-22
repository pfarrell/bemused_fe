# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (proxies /api to localhost:9292)
npm run build     # Production build (sets base to /bemused/frontend/)
npm run lint      # Run ESLint
npm run deploy    # Build and rsync to patf.com via SSH on port 10022
```

There are no tests.

## Architecture

This is a React SPA for a personal music streaming service called "P·Share". It talks to a backend API (a separate Ruby/Rack app running on port 9292 in dev, `https://patf.net/bemused` in production).

**Routing** (`src/App.jsx`): `/login` renders without a layout; all other routes render inside `Layout`. The basename switches between `/` (dev) and `/bemused/app` (prod) via `import.meta.env.DEV`.

**Layout** (`src/components/Layout.jsx`): Fixed header with `SearchBar`, scrollable `.main-content` div, fixed footer with `NowPlaying` + `MusicPlayerWrapper`.

**Audio player**: An external `window.AudioPlayer` class is loaded at runtime from `player.js` (served from `public/` in dev, `/bemused/frontend/player.js` in prod). `MusicPlayerWrapper` instantiates it and registers it in `playerStore`. All other components that want to play audio get `playerInstance` from `usePlayerStore()` and call its methods directly (`clearPlaylist`, `addTrack`, `addTracks`, `loadAndPlayTrack`).

**State management** (`src/stores/`): Two Zustand stores:
- `playerStore` — holds `currentTrack`, `playlist`, `isPlaying`, `playerInstance`, `currentTrackIndex`. The store's `playerInstance` is the live `window.AudioPlayer` object.
- `authStore` — holds `user`, `isAuthenticated`, `isAdmin`. Auth token is stored in `localStorage` as `authToken` and attached to all API calls via an axios interceptor.

**API** (`src/services/api.js`): Single axios instance. `apiService.getImageUrl(imagePath, context)` maps image paths to absolute URLs at `https://patf.net/images/` using context strings: `artist_search`, `artist_page`, `album_small`, `album_page`. The `apiService.log(id)` call fires at the 5-second mark of a track via the `onFiveSecondMark` player callback.

**Pages and data shapes**:
- `Home` — fetches `getRandomArtists(60)` → array of artist objects
- `Artist` (`/artist/:id`) — fetches `getArtist(id)` → `{ artist, summary, albums }`. Clicking the artist name triggers a data reload.
- `Album` (`/album/:id`) — fetches `getAlbum(id)` → `{ artist, album, tracks, summary }`. Clicking the album title triggers a reload.
- `Search` (`/search?q=...`) — fetches `search(query)` → `{ artists, albums, tracks, playlists }`

**Track component** (`src/components/Track.jsx`): Accepts `{ track, index, trackCount, includeMeta, isPlaying }`. When `includeMeta=true` (used in Search), shows album/artist links below the title. Track objects have the shape `{ id, title, duration, artist: { id, name }, album: { id, title, artist: { id, name } } }`.

**Styling**: Tailwind v4 + custom CSS in `src/index.css`. CSS classes (`.app-header`, `.main-content`, `.app-footer`, `.artist-grid`, `.track-item`, `.now-playing`, etc.) are defined there. The layout uses fixed header/footer (4.5em each) with a flex-column body. Many mobile overrides use `!important` due to competing inline styles on page components.
