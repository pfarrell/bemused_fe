// The pseudo-album title used to group an artist's standalone singles.
// One album per artist, matched by (title, artist_id). Read by the Make
// Single admin action, the upload queue worker (when is_single is set),
// GET /artist/:id, and search/random-pick exclusion filters.
export const SINGLES_ALBUM_TITLE = '_Singles'
