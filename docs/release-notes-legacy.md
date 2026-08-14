# Release Notes — Legacy (bemused_v2)

Before P·Share (see `docs/release-notes.md`), there was **bemused** — a Ruby/Sinatra media library running from 2014 through late 2025, in the `bemused_v2` repo. This covers that project's history, plus the companion `music-player` repo (a standalone custom HTML5 audio player, built in early-to-mid 2025) folded into the relevant weeks — it's what set the stage for continuous, gapless-feeling playback and later became the seed of the player architecture P·Share still uses today.

Same format as the current doc: weekly for the active 2025 stretch, monthly for the dense original 2014–2016 build, and condensed multi-year summaries for the long quiet maintenance stretches in between.

## 2025: the final year, and the birth of the React frontend

**Week of January 6–12** — Built a new custom music player (new `music-player` repo) to replace jPlayer, with playlist support and track-play logging; began integrating it into bemused, including early iOS viewport fixes.

**Week of January 13–19** — First working version of a "long-lived" player that persists across page navigation instead of reloading; player bug fixes and hardcoded styling cleanup.

**Week of January 20–26** — Drag-and-drop playlist reordering, next-track preloading, and a hybrid SPA-style navigation model (links load content without a full page reload); added artist/album summaries.

**Week of January 27 – February 2** — Mobile CSS and admin UI refactor.

**Week of February 3–9** — SPA-style page transitions, URL resolution fixes in admin, tag editing fixes; player gained rudimentary next-track preload support.

**Week of February 10–16** — Responsive grid layouts for search, album, artist, and admin pages; new single-column mobile layout; front page redesign.

**Week of February 17–23** — Search results now include tracks (not just albums/artists); added scroll-to-top on page transitions and a track duration field.

**Week of March 10–16** — Removed the old dual-audio-element preloading hack now that the new player handled it natively; added an advanced-queueing dropdown for tracks.

**Week of March 17–23** — Merged a broader visual upgrade.

**Week of April 14–27** — Playlist ordering and duration-formatting fixes; fixed Wikipedia summaries not showing for some albums.

**Week of April 28 – May 4** — Added PostgreSQL trigram/unaccent search support and a loading indicator, and rewrote search as a faster union query.

**Week of May 5–11** — Playback no longer restarts the whole playlist after the last track finishes; simplified shuffle; added an OpenSearch browser integration; player gained "highlight first track at playlist end."

**Week of May 12–18** — Upload improvements: reference artists/albums by ID or name, optional track padding for combining multi-disc albums, and (briefly) image handling during upload.

**Week of May 19–25** — Track titles now default to the filename when tags are missing; empty albums/artists excluded from search.

**Week of May 26 – June 15** — Fixed image processing for PNG covers, handled missing tags/files more gracefully during processing, and rewrote search to combine similarity and exact-match queries.

**Week of June 16–22** — The stats page was rebuilt in React — the first React code in the project — with the build system updated to compile it on deploy; the player library got its final polish (proper module export, cleaner playlist-control handling) right around the same time the standalone frontend that would eventually become P·Share was taking shape.

**Week of June 23–29** — Reworked JSON API responses (nested artist/album objects, image paths, track ordering) to properly serve the new React frontend; tightened search query validation.

**November** — A couple of isolated maintenance commits (compilation retagging script, a null-safety fix) while active development had shifted to the separate frontend project. bemused_v2 saw no further commits before the full Node/PostgreSQL rewrite (see the current doc's "March–April 2026: Backend rewrite") superseded it.

## 2022–2024: Maintenance mode

Mostly dependency and security updates (Ruby, Rack, Nokogiri, Sinatra, bundler). The one substantive stretch was February–April 2022: replaced the old "moth" authentication gem with a JWT + bcrypt login system, dropped Passenger, and redesigned the artist and album page layouts. The performance visualizer was removed after suspicion it was affecting playback over time.

## 2020–2021: Maintenance mode

A handful of update passes — renamed the app, updated Ruby and most dependencies, refactored the visualizer, and did a security-driven Rack/Capistrano upgrade.

## 2017: Favorites, polish, then quiet

Added a proper Favorites feature (favorite/unfavorite tracks and playlists on the fly, shuffle-play your favorites), a "resume where you left off" feature, and a jPlayer upgrade. Went quiet after April, aside from one build fix in October.

## 2016: Inline editing, Wikipedia, accounts, and visualization

**March** — Click-to-edit (ajax, save-on-blur) for album and track fields in admin.

**April** — Wikipedia summaries for artists and albums, a full tagging system (add/remove/search/autocomplete tags on albums and artists), and a big push on test coverage and keyboard-shortcut cleanup.

**May** — Passwordless email authentication and user accounts, an early "opinions" (favorites-precursor) feature, a D3.js audio visualizer synced to the player, and a stats dashboard (popular tracks, weekly listening stats) — plus a move to a fluid, more mobile-friendly layout.

**June–July** — Per-track Wikipedia lookups, visualizer refinements, more test coverage.

**November–December** — Playlists became searchable; shipped an MVP of the modern Favorites feature and track-play notifications; replaced the auth system with "moth"-based authentication.

## 2015: Keyboard control, testing discipline, and the move to Postgres

**January–February** — Full keyboard control of the player (play/pause/seek/fast-forward), with careful handling so shortcuts didn't interfere with search/forms.

**March–April** — Refactored playlist–track relationships into a proper model, and invested heavily in test coverage (specs for uploads, artists, albums, admin routes) with transaction-wrapped tests.

**August** — Migrated the database from MySQL to PostgreSQL.

**October–December** — Small fixes and an artist-name refactor; added artist images to the artist page.

## 2014: The original build

Started in June 2014 as a Sinatra app: artist/album/track models, file uploads, a masonry grid UI, streaming with play logging, and rudimentary admin editing. Over the rest of the year: playlists, autocomplete search with a command syntax (typing `/artist` or similar), keyboard-drivable "radio" and "surprise" auto-playlists, a word-count/analytics feature, HTTPS, and an early automated test suite.
