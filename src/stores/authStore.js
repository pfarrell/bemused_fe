// src/stores/authStore.js
import { create } from 'zustand';
import { apiService } from '../services/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  loading: false,

  setUser: (user) => {
    set({
      user,
      isAuthenticated: true,
      isAdmin: user?.admin || false
    });
  },

  signup: async (username, password, email = null) => {
    set({ loading: true });
    try {
      const response = await apiService.signup(username, password, email);
      const { user } = response.data;

      set({
        user,
        isAuthenticated: true,
        isAdmin: user.admin || false,
        loading: false
      });

      return { success: true };
    } catch (error) {
      set({ loading: false });
      return {
        success: false,
        error: error.response?.data?.error || 'Signup failed'
      };
    }
  },

  login: async (username, password) => {
    set({ loading: true });
    try {
      const response = await apiService.login(username, password);
      const { user } = response.data;

      set({
        user,
        isAuthenticated: true,
        isAdmin: user.admin || false,
        loading: false
      });

      return { success: true };
    } catch (error) {
      set({ loading: false });
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  },

  logout: async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isAdmin: false
      });
    }
  },

  // Initialize by checking with the backend
  initialize: async () => {
    set({ loading: true });
    try {
      console.log('Initializing auth...');
      const response = await apiService.getMe();
      const { user } = response.data;
      console.log('Auth initialized with user:', user);
      set({
        user,
        isAuthenticated: true,
        isAdmin: user.admin || false,
        loading: false
      });
      return true;
    } catch (error) {
      // Not authenticated or session expired
      console.log('Auth initialization failed:', error.response?.status, error.response?.data);
      set({
        user: null,
        isAuthenticated: false,
        isAdmin: false,
        loading: false
      });
      return false;
    }
  }
}));
