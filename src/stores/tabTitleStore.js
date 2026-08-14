import { create } from 'zustand';

// Lets a page-scoped feature (e.g. AdminUpload's background-upload notifier)
// temporarily take over document.title without racing usePlayerEngine's own
// title updates, which run globally on every page. usePlayerEngine treats a
// non-null override as higher priority than the current track's title.
export const useTabTitleStore = create((set) => ({
  override: null,
  setOverride: (title) => set({ override: title }),
  clearOverride: () => set({ override: null }),
}));
