// src/stores/authStore.js
import { create } from 'zustand';
import { apiService } from '../services/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  loading: false,
  
  login: async (credentials) => {
    set({ loading: true });
    try {
      const response = await apiService.login(credentials);
      const { user, token } = response.data;
      
      localStorage.setItem('authToken', token);
      set({ 
        user, 
        isAuthenticated: true, 
        isAdmin: user.admin || user.role === 'admin' || false,
        loading: false 
      });
      
      return { success: true };
    } catch (error) {
      set({ loading: false });
      return { 
        success: false, 
        error: error.response?.data?.message || 'Login failed' 
      };
    }
  },
  
  logout: async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('authToken');
      set({ 
        user: null, 
        isAuthenticated: false, 
        isAdmin: false 
      });
    }
  },
  
  checkAuth: () => {
    const token = localStorage.getItem('authToken');
    if (token) {
      // TODO: Verify token with backend
      // For now, just assume it's valid
      set({ isAuthenticated: true });
    }
  },
  
  initialize: async () => {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        // TODO: Call your backend to verify the token and get user info
        // const response = await apiService.getCurrentUser();
        // set({ user: response.data, isAuthenticated: true, isAdmin: response.data.admin });
        
        // For now, just set as authenticated
        set({ isAuthenticated: true });
      } catch (error) {
        // Token is invalid, remove it
        localStorage.removeItem('authToken');
        set({ isAuthenticated: false });
      }
    }
  }
}));
