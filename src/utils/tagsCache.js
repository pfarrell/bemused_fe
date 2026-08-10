// src/utils/tagsCache.js
//
// Module-scope cache for the tag list fetched by TagFilterControl. That
// component mounts/unmounts along with the hamburger dropdown (and also
// lives on the Account page), so without this it would refetch
// apiService.getTags() on every single mount. Kept deliberately simple — no
// invalidation strategy — since a personal app's tag list barely ever
// changes within a page load.
import { apiService } from '../services/api';

let cachedTagsPromise = null;

export const getTagsCached = () => {
  if (!cachedTagsPromise) {
    cachedTagsPromise = apiService.getTags();
  }
  return cachedTagsPromise;
};

// Exported solely so tests can reset the module-scope cache between cases;
// not used by any app code.
export const __resetTagsCacheForTests = () => { cachedTagsPromise = null; };
