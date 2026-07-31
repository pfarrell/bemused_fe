import { useLocation } from 'react-router-dom';

// Always calls useLocation unconditionally (Rules of Hooks) — the `path`
// null-check lives in the return value, not in whether the hook runs, so
// callers can pass e.g. `track.album?.id ? `/album/${track.album.id}` : null`
// without ever conditionally calling this hook.
export const useIsCurrentPage = (path) => {
  const location = useLocation();
  return path != null && location.pathname === path;
};
