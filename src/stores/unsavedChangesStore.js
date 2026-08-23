import { create } from 'zustand';

// Lets the currently-mounted admin edit page tell Layout (which owns the
// pull-to-refresh gesture) that it has unsaved edits and how to save them,
// so a pull-to-refresh doesn't silently wipe out in-progress edits.
export const useUnsavedChangesStore = create((set) => ({
  hasUnsavedChanges: false,
  save: null, // async () => void, or null when nothing is registered
  setUnsavedChanges: (hasUnsavedChanges, save) => set({ hasUnsavedChanges, save }),
  clear: () => set({ hasUnsavedChanges: false, save: null }),
}));
