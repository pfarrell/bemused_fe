import { create } from 'zustand';

const STORAGE_KEY = 'playlist-sort';

export const usePlaylistSortStore = create((set) => ({
  sortBy: localStorage.getItem(STORAGE_KEY) ?? 'recent',
  setSortBy: (sortBy) => {
    localStorage.setItem(STORAGE_KEY, sortBy);
    set({ sortBy });
  },
}));
