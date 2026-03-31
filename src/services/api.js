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

// Enable credentials for httpOnly cookie
api.defaults.withCredentials = true;

export const apiService = {
  // Auth
  signup: (username, password, email = null) => api.post('/auth/signup', { username, password, email }),
  login: (username, password) => api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  
  // Artists
  getRandomArtists: (size = 60) => api.get(`/artists/random?size=${size}`),
  getArtist: (id) => api.get(`/artist/${id}`), // Returns { artist, summary, albums }
  
  // Albums  
  getAlbum: (id) => api.get(`/album/${id}`), // Returns { artist, album, tracks }
  
  // Search
  search: (query) => api.get(`/search?q=${encodeURIComponent(query)}`),

  // log
  log: (id) => api.get(`/log/${id}`),
  getLogs: (page = 1, limit = 25) => api.get(`/log/admin?page=${page}&limit=${limit}`),

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
  getAlbumSecondaryArtists: (id) => api.get(`/admin/album/${id}/artists`),
  addArtistToAlbum: (albumId, artistId, role) => api.post(`/admin/album/${albumId}/artists`, { artist_id: artistId, role }),
  removeArtistFromAlbum: (albumId, artistId) => api.delete(`/admin/album/${albumId}/artists/${artistId}`),
  getArtistSecondaryAlbums: (id) => api.get(`/admin/artist/${id}/albums`),
  addAlbumToArtist: (artistId, albumId, role) => api.post(`/admin/artist/${artistId}/albums`, { album_id: albumId, role }),
  removeAlbumFromArtist: (artistId, albumId) => api.delete(`/admin/artist/${artistId}/albums/${albumId}`),
  getRelatedArtists: (id) => api.get(`/admin/artist/${id}/related`),
  addRelatedArtist: (artistId, relatedArtistId, kind = 'related') => api.post(`/admin/artist/${artistId}/related`, { related_artist_id: relatedArtistId, kind }),
  removeRelatedArtist: (artistId, relatedArtistId) => api.delete(`/admin/artist/${artistId}/related/${relatedArtistId}`),

  // Upload
  uploadTracks: (formData) => api.post('/admin/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getUploadStatus: () => api.get('/admin/upload/status'),
  getRecentUploads: (limit = 50) => api.get(`/admin/upload/recent?limit=${limit}`),

  // Playlists
  getPlaylists: () => api.get('/playlists'),
  getPlaylist: (id) => api.get(`/playlist/${id}`),
  createPlaylist: (name) => api.post('/playlists', { name }),
  addTrackToPlaylist: (playlistId, trackId) => api.post(`/playlist/${playlistId}/tracks`, { track_id: trackId }),
  removeTrackFromPlaylist: (playlistId, trackId) => api.delete(`/playlist/${playlistId}/tracks/${trackId}`),
  reorderPlaylistTracks: (playlistId, track_orders) => api.patch(`/playlist/${playlistId}/tracks/reorder`, { track_orders }),
  updatePlaylist: (id, data) => api.put(`/playlist/${id}`, data),
  downloadPlaylistImage: (id, image_url, image_name) => api.post(`/admin/playlist/${id}/image`, { image_url, image_name }),

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
