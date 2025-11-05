// src/services/api.js
import axios from 'axios';

const getBaseURL = () => {
  if (import.meta.env.DEV) {
    return '/api';
  } else {
    return 'https://patf.net/bemused';
  }
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const apiService = {
  // Auth
  login: (credentials) => api.post('/login', credentials),
  logout: () => api.post('/logout'),
  
  // Artists
  getRandomArtists: (size = 60) => api.get(`/artists/random?size=${size}`),
  getArtist: (id) => api.get(`/artist/${id}`), // Returns { artist, summary, albums }
  
  // Albums  
  getAlbum: (id) => api.get(`/album/${id}`), // Returns { artist, album, tracks }
  
  // Search
  search: (query) => api.get(`/search?q=${encodeURIComponent(query)}`),

  // log
  log: (id) => api.get(`/log/${id}`),
  
  // Image URL helpers
  getImageUrl: (imagePath, context = 'base') => {
    if (!imagePath) return null;
    
    const baseUrl = 'https://patf.net/images';
    
    switch (context) {
      case 'artist_search':
        return `${baseUrl}/artists/sm/${imagePath}`;
      case 'artist_page':
        return `${baseUrl}/artists/${imagePath}`;
      case 'album_small':
        return `${baseUrl}/albums/sm/${imagePath}`;
      case 'album_page':
        return `${baseUrl}/albums/${imagePath}`;
      case 'base':
      default:
        return `${baseUrl}/${imagePath}`;
    }
  }
};

export default api;
