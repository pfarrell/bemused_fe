// src/stores/favoritesStore.js
import { create } from 'zustand';
import { apiService } from '../services/api';

export const useFavoritesStore = create((set, get) => ({
  items: [],
  loading: false,
  loaded: false,

  load: async () => {
    set({ loading: true });
    try {
      const response = await apiService.getFavorites();
      set({ items: response.data, loading: false, loaded: true });
    } catch (error) {
      console.error('Failed to load favorites:', error);
      set({ loading: false, loaded: true });
    }
  },

  clear: () => {
    set({ items: [], loading: false, loaded: false });
  },

  isFavorite: (kind, targetId) => {
    return get().items.some((f) => f.kind === kind && f.target_id === targetId);
  },

  toggleFavorite: async (kind, targetId, itemData) => {
    const { items } = get();
    const existing = items.find((f) => f.kind === kind && f.target_id === targetId);

    if (existing) {
      set({ items: items.filter((f) => f !== existing) });
      try {
        await apiService.removeFavorite(kind, targetId);
      } catch (error) {
        console.error('Failed to remove favorite:', error);
        set({ items: [...get().items, existing] });
      }
    } else {
      const optimistic = { id: `optimistic-${kind}-${targetId}`, kind, target_id: targetId, created_at: new Date().toISOString(), item: itemData };
      set({ items: [optimistic, ...items] });
      try {
        const response = await apiService.addFavorite(kind, targetId);
        set({ items: get().items.map((f) => (f === optimistic ? response.data : f)) });
      } catch (error) {
        console.error('Failed to add favorite:', error);
        set({ items: get().items.filter((f) => f !== optimistic) });
      }
    }
  },
}));
