# Release Notes

P·Share doesn't do versioned releases, so this is a running summary of what's shipped instead, organized by week (and by month for the quieter early stretches). Newest at top.

For the project's earlier life as a Ruby app (2014–2025), see `docs/release-notes-legacy.md`.

## Week of August 3–9, 2026

**Save the queue as a playlist**
- Right-click (desktop) or long-press (mobile) the queue icon or empty drawer background to save your current play queue as a new playlist in one step.

**Shuffle & repeat**
- Replaced the old shuffle toggle with a single cycle button: off → shuffle → repeat all → repeat one.
- Fixed shuffle not being honored when starting a fresh queue from "Play Now," and a shuffled queue no longer stalls when it finishes — it resumes with a new random track.
- Fixed the app occasionally freezing for a moment while a track was loading.

**Playlists & Collections polish**
- Playlist and collection pages now show an auto-generated cover collage (a grid of the albums inside) when no custom image has been set.
- Collections can now show a Wikipedia summary, editable from the admin page.
- Cleaned up redundant page titles on the Collections and Favorites pages.

**Now Playing & queue navigation**
- The now-playing track title links to its source playlist.
- Added "Go to Playlist / Album / Artist" to the queue drawer's menu, and the drawer now closes automatically after you use one of those links.
- The browser tab title now shows the currently playing track.

**Library maintenance**
- Added a "Make Single" action to move a track into its artist's singles collection, available from the album page, admin, and track menus.
- Improved MusicBrainz metadata matching: release years now auto-fill and use more accurate dates, and a backfill tool can re-check just the albums that previously failed to match.
- Singles are now excluded from search results and random picks, so they don't show up mixed in with full albums.

**Fixes**
- Fixed album art sometimes not showing up on the lock screen, Control Center, or in the car over Bluetooth/CarPlay.
- Fixed several admin pages (album, artist, playlist, collection, upload) where search buttons rendered off the edge of the screen on mobile.

## Week of July 27 – August 2, 2026

**Notes on albums, tracks, and collections**
- Added freeform notes (with markdown support, including tables) to albums, tracks, and collections, backed by Recall — connect your Recall account from the account page.

**Sign in with Google**
- Added "Continue with Google" to login and signup, and an account page to manage your Google connection and password.

**Favorites**
- Added a Favorite action to artists, albums, playlists, collections, and tracks via the same right-click/long-press menu used elsewhere.
- Rebuilt the Library page into a tabbed Favorites browser.

**Fixes**
- Fixed duplicate "image not found" placeholders showing up in the admin image picker.
- Fixed the image preview not updating after setting a newly-added image as primary.
- Fixed the right-click/long-press menu sometimes appearing behind other elements, and a few mobile long-press edge cases (phantom taps, unwanted Download option).

## Week of July 20–26, 2026

**Search overhaul**
- Search results across albums, artists, playlists, and collections are now ranked together by confidence in one unified list instead of separate sections per type, with type filter pills and infinite scroll.
- Quoted search terms now do exact matching.

**Browsing polish**
- Added a more compact row layout for search/browse results on mobile, with larger thumbnails and tighter spacing.
- Long-press (or right-click) the play button on a row for Play Now / Play Next / Add to Queue without opening the item.
- The home feed now restores your scroll position and cached results when you navigate back to it, and can be force-refreshed via pull-to-refresh or tapping the logo.
- Albums now show which collections they belong to, linked from the album page.

## Week of July 13–19, 2026

**Sharing**
- Added a share button to album, artist, and playlist pages, and share links now render proper preview cards (Open Graph tags) when posted elsewhere.

**Mobile polish**
- Reorganized the album page's mobile action row and consolidated Play Now/Play Next/Add to Queue into one dropdown.
- Long Wikipedia summaries now truncate to one line on mobile with a "Show more" toggle.

**Behind the scenes**
- Added deploy-status tracking so it's easy to check whether a given change has actually gone out to production.

## Week of July 6–12, 2026

**MusicBrainz matching**
- Added a way to manually search for or paste a MusicBrainz ID from the admin album/artist pages, for cases the automatic matcher gets wrong.

**Counts everywhere**
- Track and album counts now show up on artist/album/playlist cards, search results, and tag browsing, instead of just on the detail pages.

## Week of June 29 – July 5, 2026

**Various-artists / compilation albums**
- Added proper support for compilation albums — individual track-level artist credits, a compilation checkbox in admin/upload, and artist search now matches on track-level credits too.

**Library maintenance tools**
- Added a "reprocess" tool that re-runs metadata matching on an existing album and shows a before/after preview before applying changes.
- Unified the artist merge and move-tracks admin tools into one flow.

**Track downloads**
- Added a Download option to the track context menu.

**Home network access**
- The app is now reachable directly on the home LAN (in addition to the public domain), with its own isolated login session.

## Week of June 22–28, 2026

- Backend refactor: pulled business logic for auth, streaming, albums, and search out of route handlers into dedicated service modules (no user-visible change, but sets up cleaner future work).

## Week of June 15–21, 2026

**Gapless playback rewrite**
- Rewrote the audio player from the ground up around a single Zustand store as the source of truth, with two audio elements so the next track can be silently pre-loaded and handed off with no gap or reload.
- Rewrote the playlist drawer as a proper React component to match.

**Mobile PWA polish**
- Fixed a doubled safe-area inset that made the header/footer render too tall on an installed iPhone PWA.
- Added album art to the playlist drawer and fixed it never showing up in the now-playing footer.
- Replaced the queue/play-next toast with a lighter inline activity pulse, moved the buffering indicator into the progress bar, and made long-press menus stay open after releasing your finger for easier one-handed use.

## Week of June 8–14, 2026

- Added a track-approval gate so only approved tracks are visible on public API routes.
- Fixed the installed PWA's header and footer rendering roughly 2.5x too tall on iPhone due to a safe-area-inset calculation bug.
- Fixed search including artists with no approved tracks.

## Week of June 1–7, 2026

- Set up the frontend test suite (Vitest + React Testing Library) and a GitHub Actions workflow to run lint/tests/backend build on every push.
- Converted the mobile site into an installable PWA.
- Spiked a dependency-injection pattern for backend services, starting with logs and auth middleware.

## Week of May 25–31, 2026

- Added the Collections feature (curated groups of albums).
- Added a tagging system — tag artists/albums/tracks, filter your home feed by tag, and browse by tag with autocomplete.
- Added infinite scroll and an Artists/Albums toggle to the home page.
- Album art now displays prominently while a track is playing.

## March–April 2026: Backend rewrite

**March**: Replaced the original Ruby backend with a new Node/PostgreSQL API (Hono + Kysely), and built out the admin side from scratch — album/track editing, uploads, admin user roles, playlists, playback logs, plus a mobile hamburger menu and pull-to-refresh.

**April**: Added MusicBrainz ID matching with a discovery script, an images table with a gallery UI and automatic image lookup from Last.fm and Fanart.tv, image resizing, and artist relations (related artists, band members, "member of") with duplicate-artist merging. Playback now survives logging in or out instead of resetting.

## 2025: Origins

The original P·Share started in June 2025 as a React frontend paired with a Ruby backend — the core player, playlists, search, deep linking, and mobile styling were all built out in the first couple of weeks. Development was sparse for the rest of the year (a handful of navigation and hosting fixes between October and December), before picking back up in March 2026 with the full backend rewrite above.
