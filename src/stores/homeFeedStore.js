import { create } from 'zustand';

const EMPTY_CACHE = { key: null, items: [], hasMore: true, seenIds: new Set(), scrollTop: 0 };

export const useHomeFeedStore = create((set, get) => ({
  ...EMPTY_CACHE,
  save: (key, partial) => set(get().key === key
    ? { key, ...partial }
    : { ...EMPTY_CACHE, key, ...partial }),
  invalidate: () => set({ ...EMPTY_CACHE }),
}));

export function getHomeFeedCache(key) {
  const state = useHomeFeedStore.getState();
  return state.key === key ? state : null;
}
