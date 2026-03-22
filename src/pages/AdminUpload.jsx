// src/pages/AdminUpload.jsx
import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const AdminUpload = () => {
  // Form state
  const [artistInput, setArtistInput] = useState('');
  const [albumInput, setAlbumInput] = useState('');
  const [genre, setGenre] = useState('');
  const [trackPad, setTrackPad] = useState('0');
  const [albumArtUrl, setAlbumArtUrl] = useState('');
  const [albumArtName, setAlbumArtName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Status
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Recent uploads
  const [recentUploads, setRecentUploads] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // Upload stats
  const [stats, setStats] = useState(null);

  // Artist search modal state
  const [showArtistSearchModal, setShowArtistSearchModal] = useState(false);
  const [artistSearchQuery, setArtistSearchQuery] = useState('');
  const [artistSearchResults, setArtistSearchResults] = useState([]);

  // Album search modal state
  const [showAlbumSearchModal, setShowAlbumSearchModal] = useState(false);
  const [albumSearchQuery, setAlbumSearchQuery] = useState('');
  const [albumSearchResults, setAlbumSearchResults] = useState([]);

  useEffect(() => {
    loadRecentUploads();
    loadStats();

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      loadRecentUploads();
      loadStats();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadRecentUploads = async () => {
    try {
      setLoadingRecent(true);
      const response = await apiService.getRecentUploads(20);
      setRecentUploads(response.data);
    } catch (error) {
      console.error('Failed to load recent uploads:', error);
    } finally {
      setLoadingRecent(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiService.getUploadStatus();
      setStats(response.data.stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleFileChange = (e) => {
    setSelectedFiles(Array.from(e.target.files));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedFiles.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();

      // Add files
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      // Add metadata
      if (artistInput) formData.append('artist_name', artistInput);
      if (albumInput) formData.append('album_name', albumInput);
      if (genre) formData.append('genre', genre);
      if (trackPad) formData.append('track_pad', trackPad);
      if (albumArtUrl) formData.append('album_art_url', albumArtUrl);
      if (albumArtName) formData.append('album_art_name', albumArtName);

      const response = await apiService.uploadTracks(formData);

      setMessage(`Successfully queued ${response.data.queued} file(s) for processing`);

      // Auto-clear success message after 5 seconds
      setTimeout(() => setMessage(null), 5000);

      // Clear form
      setArtistInput('');
      setAlbumInput('');
      setGenre('');
      setTrackPad('0');
      setAlbumArtUrl('');
      setAlbumArtName('');
      setSelectedFiles([]);

      // Reset file input
      const fileInput = document.getElementById('file-input');
      if (fileInput) fileInput.value = '';

      // Reload recent uploads and stats
      loadRecentUploads();
      loadStats();
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.response?.data?.error || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'processing': return '#3b82f6';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Artist search handlers
  const handleArtistSearch = async (e) => {
    e.preventDefault();
    if (artistSearchQuery.length < 2) {
      setError('Please enter at least 2 characters to search');
      return;
    }

    try {
      const response = await apiService.search(artistSearchQuery);
      setArtistSearchResults(response.data.artists || []);
    } catch (error) {
      console.error('Error searching artists:', error);
      setError('Failed to search artists');
    }
  };

  const handleSelectArtist = (artist) => {
    setArtistInput(String(artist.id));
    setShowArtistSearchModal(false);
    setArtistSearchQuery('');
    setArtistSearchResults([]);
  };

  // Album search handlers
  const handleAlbumSearch = async (e) => {
    e.preventDefault();
    if (albumSearchQuery.length < 2) {
      setError('Please enter at least 2 characters to search');
      return;
    }

    try {
      const response = await apiService.search(albumSearchQuery);
      setAlbumSearchResults(response.data.albums || []);
    } catch (error) {
      console.error('Error searching albums:', error);
      setError('Failed to search albums');
    }
  };

  const handleSelectAlbum = (album) => {
    setAlbumInput(String(album.id));
    setShowAlbumSearchModal(false);
    setAlbumSearchQuery('');
    setAlbumSearchResults([]);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '2rem' }}>Upload Tracks</h1>

      {/* Stats Cards */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{ padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Pending</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.pending}</div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: '#dbeafe', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>Processing</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e40af' }}>{stats.processing}</div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: '#d1fae5', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.875rem', color: '#065f46' }}>Completed</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#065f46' }}>{stats.completed}</div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: '#fee2e2', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.875rem', color: '#991b1b' }}>Failed</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#991b1b' }}>{stats.failed}</div>
          </div>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: '#d1fae5',
          color: '#065f46',
          borderRadius: '4px'
        }}>
          {message}
        </div>
      )}

      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      {/* Upload Form */}
      <form onSubmit={handleSubmit} style={{
        padding: '2rem',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
          Upload New Tracks
        </h2>

        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {/* Artist Input */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Artist (name or ID)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={artistInput}
                onChange={(e) => setArtistInput(e.target.value)}
                placeholder="e.g., The Beatles or 123"
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              />
              <button
                type="button"
                onClick={() => setShowArtistSearchModal(true)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Search
              </button>
            </div>
            <small style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Optional. Enter artist name or numeric ID. Overrides ID3 tags.
            </small>
          </div>

          {/* Album Input */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Album (name or ID)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={albumInput}
                onChange={(e) => setAlbumInput(e.target.value)}
                placeholder="e.g., Abbey Road or 456"
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              />
              <button
                type="button"
                onClick={() => setShowAlbumSearchModal(true)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Search
              </button>
            </div>
            <small style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Optional. Enter album name or numeric ID. Overrides ID3 tags.
            </small>
          </div>

          {/* Genre and Track Pad */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Genre
              </label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="e.g., Rock"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Track Pad
              </label>
              <input
                type="number"
                value={trackPad}
                onChange={(e) => setTrackPad(e.target.value)}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              />
              <small style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                Offset for multi-disc
              </small>
            </div>
          </div>

          {/* Album Art */}
          <div style={{
            padding: '1rem',
            backgroundColor: '#fff',
            borderRadius: '4px',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Album Art (Optional)
            </h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Image URL
              </label>
              <input
                type="text"
                value={albumArtUrl}
                onChange={(e) => setAlbumArtUrl(e.target.value)}
                placeholder="https://example.com/cover.jpg"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Save as Filename
              </label>
              <input
                type="text"
                value={albumArtName}
                onChange={(e) => setAlbumArtName(e.target.value)}
                placeholder="abbey_road.jpg"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Audio Files *
            </label>
            <input
              id="file-input"
              type="file"
              multiple
              accept=".mp3,.m4a,.flac"
              onChange={handleFileChange}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '1rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            />
            {selectedFiles.length > 0 && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                {selectedFiles.length} file(s) selected
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={uploading || selectedFiles.length === 0}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: uploading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontWeight: '500',
            }}
          >
            {uploading ? 'Uploading...' : 'Upload Tracks'}
          </button>
        </div>
      </form>

      {/* Recent Uploads */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Recent Uploads</h2>
          <button
            onClick={loadRecentUploads}
            disabled={loadingRecent}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.875rem',
              cursor: loadingRecent ? 'not-allowed' : 'pointer',
            }}
          >
            {loadingRecent ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {recentUploads.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.875rem',
              backgroundColor: 'white',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Filename</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Artist</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Album</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Created</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Error</th>
                </tr>
              </thead>
              <tbody>
                {recentUploads.map((upload) => (
                  <tr key={upload.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: 'white',
                        backgroundColor: getStatusColor(upload.status)
                      }}>
                        {upload.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>{upload.original_filename}</td>
                    <td style={{ padding: '0.75rem' }}>{upload.artist_name || upload.artist_id || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{upload.album_name || upload.album_id || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{formatDate(upload.created_at)}</td>
                    <td style={{ padding: '0.75rem', color: '#ef4444', fontSize: '0.75rem' }}>
                      {upload.error_message || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            color: '#6b7280',
            backgroundColor: '#f9fafb',
            borderRadius: '4px'
          }}>
            No recent uploads
          </div>
        )}
      </div>

      {/* Artist Search Modal */}
      {showArtistSearchModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowArtistSearchModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              Search for Artist
            </h3>
            <form onSubmit={handleArtistSearch} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={artistSearchQuery}
                  onChange={(e) => setArtistSearchQuery(e.target.value)}
                  placeholder="Enter artist name..."
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    fontSize: '1rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1.5rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    cursor: 'pointer',
                  }}
                >
                  Search
                </button>
              </div>
            </form>

            {artistSearchResults.length > 0 ? (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  Click an artist to select:
                </p>
                <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                  {artistSearchResults.map((artist) => (
                    <div
                      key={artist.id}
                      onClick={() => handleSelectArtist(artist)}
                      style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                    >
                      <div>
                        <div style={{ fontWeight: '500' }}>{artist.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {artist.album_count} albums · {artist.track_count} tracks
                        </div>
                      </div>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        ID: {artist.id}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : artistSearchQuery.length >= 2 ? (
              <p style={{ marginTop: '1rem', color: '#6b7280', textAlign: 'center' }}>
                No artists found. Try a different search term.
              </p>
            ) : null}

            <button
              onClick={() => setShowArtistSearchModal(false)}
              style={{
                marginTop: '1.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Album Search Modal */}
      {showAlbumSearchModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowAlbumSearchModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              Search for Album
            </h3>
            <form onSubmit={handleAlbumSearch} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={albumSearchQuery}
                  onChange={(e) => setAlbumSearchQuery(e.target.value)}
                  placeholder="Enter album name..."
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    fontSize: '1rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1.5rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    cursor: 'pointer',
                  }}
                >
                  Search
                </button>
              </div>
            </form>

            {albumSearchResults.length > 0 ? (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  Click an album to select:
                </p>
                <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                  {albumSearchResults.map((album) => (
                    <div
                      key={album.id}
                      onClick={() => handleSelectAlbum(album)}
                      style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                    >
                      <div>
                        <div style={{ fontWeight: '500' }}>{album.title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {album.artist.name} · {album.track_count} tracks
                        </div>
                      </div>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        ID: {album.id}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : albumSearchQuery.length >= 2 ? (
              <p style={{ marginTop: '1rem', color: '#6b7280', textAlign: 'center' }}>
                No albums found. Try a different search term.
              </p>
            ) : null}

            <button
              onClick={() => setShowAlbumSearchModal(false)}
              style={{
                marginTop: '1.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUpload;
