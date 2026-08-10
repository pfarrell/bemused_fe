import { create } from 'zustand';

const STORAGE_KEY = 'browse-view-mode';

export const useViewModeStore = create((set) => ({
  mode: localStorage.getItem(STORAGE_KEY) ?? 'card',
  setMode: (mode) => {
    localStorage.setItem(STORAGE_KEY, mode);
    set({ mode });
  },
}));
