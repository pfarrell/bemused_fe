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
  getGoogleStartUrl: (returnTo = null, intent = null) => {
    const params = new URLSearchParams();
    if (returnTo) params.set('return_to', returnTo);
    if (intent) params.set('intent', intent);
    const qs = params.toString();
    return `${getBaseURL()}/auth/google/start${qs ? `?${qs}` : ''}`;
  },
  disconnectGoogle: () => api.delete('/auth/google/disconnect'),
  setPassword: (password) => api.put('/auth/set-password', { password }),
  changePassword: (currentPassword, newPassword) => api.put('/auth/change-password', { currentPassword, newPassword }),

  // Artists
  getRandomArtists: (size = 60, tag = null) => api.get(`/artists/random?size=${size}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`),
  getArtist: (id) => api.get(`/artist/${id}`), // Returns { artist, summary, albums }

  // Albums
  getAlbum: (id) => api.get(`/album/${id}`), // Returns { artist, album, tracks }
  getRandomAlbums: (size = 30, tag = null) => api.get(`/albums/random?size=${size}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`),

  // Recall notes
  getRecallConnectUrl: () => `${getBaseURL()}/auth/recall/connect`,
  addAlbumNote: (albumId, content) => api.post(`/album/${albumId}/notes`, { content }),
  deleteAlbumNote: (albumId, noteId) => api.delete(`/album/${albumId}/notes/${noteId}`),
  addCollectionNote: (collectionId, content) => api.post(`/collection/${collectionId}/notes`, { content }),
  deleteCollectionNote: (collectionId, noteId) => api.delete(`/collection/${collectionId}/notes/${noteId}`),
  addTrackNote: (trackId, content) => api.post(`/track/${trackId}/notes`, { content }),
  deleteTrackNote: (trackId, noteId) => api.delete(`/track/${trackId}/notes/${noteId}`),
  getTrackNotes: (trackId) => api.get(`/track/${trackId}/notes`),
  getRecallItemUrl: (itemId) => `https://patf.com/recall/items/${itemId}`,

  // Tags
  getTags: () => api.get('/tags'),
  getAlbumTags: (id) => api.get(`/tags/album/${id}`),
  getArtistTags: (id) => api.get(`/tags/artist/${id}`),
  getTagContent: (tagName) => api.get(`/tags/${encodeURIComponent(tagName)}/content`),
  addTagToAlbum: (id, name) => api.post(`/tags/album/${id}`, { name }),
  removeTagFromAlbum: (id, tagName) => api.delete(`/tags/album/${id}/${encodeURIComponent(tagName)}`),
  addTagToArtist: (id, name) => api.post(`/tags/artist/${id}`, { name }),
  removeTagFromArtist: (id, tagName) => api.delete(`/tags/artist/${id}/${encodeURIComponent(tagName)}`),
  setDefaultTag: (tag) => api.put('/auth/default-tag', { tag }),

  // Search
  search: (query, offset) => api.get(`/search?q=${encodeURIComponent(query)}${offset ? `&offset=${offset}` : ''}`),

  // log
  log: (id) => api.get(`/log/${id}`),
  getLogs: (page = 1, limit = 25) => api.get(`/log/admin?page=${page}&limit=${limit}`),

  // Admin
  createArtist: (name) => api.post('/admin/artist', { name }),
  createAlbum: (title, artist_id) => api.post('/admin/album', { title, artist_id }),
  searchAdminArtists: (q) => api.get(`/admin/artists/search?q=${encodeURIComponent(q)}`),
  searchAdminAlbums: (q) => api.get(`/admin/albums/search?q=${encodeURIComponent(q)}`),
  searchMusicbrainzArtist: (q) => api.get(`/admin/musicbrainz/search-artist?q=${encodeURIComponent(q)}`),
  searchMusicbrainzRelease: (q) => api.get(`/admin/musicbrainz/search-release?q=${encodeURIComponent(q)}`),
  updateArtist: (id, data) => api.put(`/admin/artist/${id}`, data),
  deleteArtist: (id) => api.delete(`/admin/artist/${id}`),
  updateAlbum: (id, data) => api.put(`/admin/album/${id}`, data),
  deleteAlbum: (id) => api.delete(`/admin/album/${id}`),
  downloadArtistImage: (id, image_url, image_name) => api.post(`/admin/artist/${id}/image`, { image_url, image_name }),
  downloadAlbumImage: (id, image_url, image_name) => api.post(`/admin/album/${id}/image`, { image_url, image_name }),
  updateTrack: (id, data) => api.put(`/admin/track/${id}`, data),
  deleteTrack: (id) => api.delete(`/admin/track/${id}`),
  makeTrackSingle: (id) => api.post(`/admin/track/${id}/make-single`),
  bulkUpdateTracks: (album_id, data) => api.patch(`/admin/album/${album_id}/tracks`, data),
  moveAlbumToArtist: (id, target_artist_id) => api.post(`/admin/album/${id}/move-to-artist`, { target_artist_id }),
  mergeAlbum: (id, destination_album_id, track_offset) => api.post(`/admin/album/${id}/merge`, { destination_album_id, track_offset }),
  getReprocessPreview: (albumId) => api.get(`/admin/album/${albumId}/reprocess-preview`),
  applyReprocess: (albumId, data) => api.post(`/admin/album/${albumId}/reprocess-apply`, data),
  getAlbumSecondaryArtists: (id) => api.get(`/admin/album/${id}/artists`),
  addArtistToAlbum: (albumId, artistId, role) => api.post(`/admin/album/${albumId}/artists`, { artist_id: artistId, role }),
  removeArtistFromAlbum: (albumId, artistId) => api.delete(`/admin/album/${albumId}/artists/${artistId}`),
  getArtistSecondaryAlbums: (id) => api.get(`/admin/artist/${id}/albums`),
  addAlbumToArtist: (artistId, albumId, role) => api.post(`/admin/artist/${artistId}/albums`, { album_id: albumId, role }),
  removeAlbumFromArtist: (artistId, albumId) => api.delete(`/admin/artist/${artistId}/albums/${albumId}`),
  getRelatedArtists: (id) => api.get(`/admin/artist/${id}/related`),
  hideArtistRelation: (artistId, relatedId, hidden) => api.patch(`/admin/artist/${artistId}/related/${relatedId}/hide`, { hidden }),
  forceShowArtistRelation: (artistId, relatedId, force_show) => api.patch(`/admin/artist/${artistId}/related/${relatedId}/force-show`, { force_show }),
  previewArtistStubs: (id) => api.get(`/admin/artist/${id}/merge-stubs`),
  mergeArtists: (id, loser_ids) => api.post(`/admin/artist/${id}/merge`, { loser_ids }),
  addRelatedArtist: (artistId, relatedArtistId, kind = 'related') => api.post(`/admin/artist/${artistId}/related`, { related_artist_id: relatedArtistId, kind }),
  removeRelatedArtist: (artistId, relatedArtistId) => api.delete(`/admin/artist/${artistId}/related/${relatedArtistId}`),

  // Upload
  uploadTracks: (formData) => api.post('/admin/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getUploadStatus: () => api.get('/admin/upload/status'),
  getRecentUploads: (limit = 50) => api.get(`/admin/upload/recent?limit=${limit}`),
  retryUpload: (id) => api.post(`/admin/upload/${id}/retry`),
  dismissUpload: (id) => api.delete(`/admin/upload/${id}`),
  clearFailedUploads: () => api.delete('/admin/upload/failed'),

  // Playlists
  getPlaylists: () => api.get('/playlists'),
  getPlaylist: (id) => api.get(`/playlist/${id}`),
  createPlaylist: (name, trackIds) => api.post('/playlists', { name, track_ids: trackIds }),
  addTrackToPlaylist: (playlistId, trackId) => api.post(`/playlist/${playlistId}/tracks`, { track_id: trackId }),
  removeTrackFromPlaylist: (playlistId, trackId) => api.delete(`/playlist/${playlistId}/tracks/${trackId}`),
  reorderPlaylistTracks: (playlistId, track_orders) => api.patch(`/playlist/${playlistId}/tracks/reorder`, { track_orders }),
  updatePlaylist: (id, data) => api.put(`/playlist/${id}`, data),
  downloadPlaylistImage: (id, image_url, image_name) => api.post(`/admin/playlist/${id}/image`, { image_url, image_name }),

  // Collections
  getCollections: () => api.get('/collections'),
  getCollection: (id) => api.get(`/collection/${id}`),
  createCollection: (name) => api.post('/collections', { name }),
  updateCollection: (id, data) => api.put(`/collection/${id}`, data),
  addAlbumToCollection: (collectionId, albumId) => api.post(`/collection/${collectionId}/albums`, { album_id: albumId }),
  addStubToCollection: (collectionId, title, artist_name) =>
    api.post(`/collection/${collectionId}/stubs`, { title, artist_name }),
  removeAlbumFromCollection: (collectionId, albumId) => api.delete(`/collection/${collectionId}/albums/${albumId}`),
  removeStubFromCollection: (collectionId, stubId) =>
    api.delete(`/collection/${collectionId}/stubs/${stubId}`),
  reorderCollectionAlbums: (collectionId, album_orders, stub_orders = []) =>
    api.patch(`/collection/${collectionId}/albums/reorder`, { album_orders, stub_orders }),
  resolveStub: (collectionId, stubId, albumId) =>
    api.post(`/collection/${collectionId}/stubs/${stubId}/resolve`, { album_id: albumId }),
  downloadCollectionImage: (id, image_url, image_name) => api.post(`/admin/collection/${id}/image`, { image_url, image_name }),

  // Favorites
  getFavorites: (kind = null) => api.get(`/favorites${kind ? `?kind=${encodeURIComponent(kind)}` : ''}`),
  addFavorite: (kind, target_id) => api.post('/favorites', { kind, target_id }),
  removeFavorite: (kind, target_id) => api.delete('/favorites', { data: { kind, target_id } }),

  // Image management
  getAlbumImages: (albumId) => api.get(`/admin/album/${albumId}/images`),
  addAlbumImage: (albumId, image_url, image_name, set_primary = false) =>
    api.post(`/admin/album/${albumId}/images`, { image_url, image_name, set_primary }),
  setAlbumImagePrimary: (albumId, imgId) =>
    api.patch(`/admin/album/${albumId}/images/${imgId}/primary`),
  deleteAlbumImage: (albumId, imgId) =>
    api.delete(`/admin/album/${albumId}/images/${imgId}`),

  getArtistImages: (artistId) => api.get(`/admin/artist/${artistId}/images`),
  addArtistImage: (artistId, image_url, image_name, set_primary = false) =>
    api.post(`/admin/artist/${artistId}/images`, { image_url, image_name, set_primary }),
  setArtistImagePrimary: (artistId, imgId) =>
    api.patch(`/admin/artist/${artistId}/images/${imgId}/primary`),
  deleteArtistImage: (artistId, imgId) =>
    api.delete(`/admin/artist/${artistId}/images/${imgId}`),

  // Image URL helpers
  getImageUrl: (imagePath, context = 'base') => {
    if (!imagePath) return null;

    const baseUrl = import.meta.env.DEV ? '/images' : 'https://patf.net/images';

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
