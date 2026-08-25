const OVERTONE_BASE = 'https://patf.com/overtone/';

// Overtone's URL scheme differs by entity type: people/artists resolve
// through its type-agnostic /entity/ route, but releases (albums) need the
// dedicated /release/ route instead. Unrecognized types (e.g. 'recording',
// which Overtone doesn't have a page for yet) fall back to /entity/.
const OVERTONE_PATH_SEGMENT = {
  artist: 'entity',
  release: 'release',
};

export const overtoneUrl = (mbid, entityType = 'artist') =>
  `${OVERTONE_BASE}${OVERTONE_PATH_SEGMENT[entityType] ?? 'entity'}/${mbid}`;
