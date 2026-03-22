// src/services/api.js
import axios from 'axios';

const getBaseURL = () => {
  if (import.meta.env.DEV) {
    return '/api';
  } else {
    return '/bemused/api';
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

  // Admin
  updateArtist: (id, data) => api.put(`/admin/artist/${id}`, data),
  deleteArtist: (id) => api.delete(`/admin/artist/${id}`),
  updateAlbum: (id, data) => api.put(`/admin/album/${id}`, data),
  deleteAlbum: (id) => api.delete(`/admin/album/${id}`),
  downloadArtistImage: (id, image_url, image_name) => api.post(`/admin/artist/${id}/image`, { image_url, image_name }),
  downloadAlbumImage: (id, image_url, image_name) => api.post(`/admin/album/${id}/image`, { image_url, image_name }),
  updateTrack: (id, data) => api.put(`/admin/track/${id}`, data),
  deleteTrack: (id) => api.delete(`/admin/track/${id}`),
  bulkUpdateTracks: (album_id, data) => api.patch(`/admin/album/${album_id}/tracks`, data),
  moveArtistArtifacts: (id, target_artist_id) => api.post(`/admin/artist/${id}/move-artifacts`, { target_artist_id }),
  moveAlbumToArtist: (id, target_artist_id) => api.post(`/admin/album/${id}/move-to-artist`, { target_artist_id }),

  // Upload
  uploadTracks: (formData) => api.post('/admin/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getUploadStatus: () => api.get('/admin/upload/status'),
  getRecentUploads: (limit = 50) => api.get(`/admin/upload/recent?limit=${limit}`),

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
