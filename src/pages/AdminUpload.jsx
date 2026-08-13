// src/pages/AdminUpload.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import jsmediatags from 'jsmediatags';

const VARIOUS_ARTISTS = { id: 161, name: 'Various Artists' };

const AdminUpload = () => {
  // Form state
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

  const [filePreviews, setFilePreviews] = useState([]);

  // Artist inline picker
  const [artistQuery, setArtistQuery] = useState('');
  const [artistResults, setArtistResults] = useState([]);
  const [artistSearching, setArtistSearching] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState(null);

  // Album inline picker
  const [albumQuery, setAlbumQuery] = useState('');
  const [albumResults, setAlbumResults] = useState([]);
  const [albumSearching, setAlbumSearching] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);

  const [isCompilation, setIsCompilation] = useState(false);

  // Prevent the exact bug that fragmented a real upload into one album per
  // ID3 artist tag: a various-artists batch must always resolve to a single,
  // stable album artist, never per-file tags. Locking the field to the
  // placeholder as soon as compilation is checked closes that gap entirely.
  useEffect(() => {
    if (isCompilation) {
      setSelectedArtist(VARIOUS_ARTISTS);
      setArtistQuery('');
      setArtistResults([]);
    }
  }, [isCompilation]);

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

  const readTags = (file) =>
    new Promise((resolve) => {
      jsmediatags.read(file, {
        onSuccess: (tag) => resolve(tag.tags),
        onError: () => resolve({}),
      });
    });

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    if (files.length === 0) {
      setFilePreviews([]);
      return;
    }
    const previews = await Promise.all(
      files.map(async (file) => {
        const tags = await readTags(file);
        return {
          filename: file.name,
          title: tags.title || null,
          artist: tags.artist || null,
          album: tags.album || null,
          track: tags.track || null,
        };
      })
    );
    setFilePreviews(previews);
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
      if (selectedArtist) {
        formData.append('artist_id', String(selectedArtist.id));
      } else if (artistQuery.trim()) {
        formData.append('artist_name', artistQuery.trim());
      }

      if (selectedAlbum) {
        formData.append('album_id', String(selectedAlbum.id));
      } else if (albumQuery.trim()) {
        formData.append('album_name', albumQuery.trim());
      }
      formData.append('is_compilation', String(isCompilation));
      if (genre) formData.append('genre', genre);
      if (trackPad) formData.append('track_pad', trackPad);
      if (albumArtUrl) formData.append('album_art_url', albumArtUrl);
      if (albumArtName) formData.append('album_art_name', albumArtName);

      const response = await apiService.uploadTracks(formData);

      setMessage(`Successfully queued ${response.data.queued} file(s) for processing`);

      // Auto-clear success message after 5 seconds
      setTimeout(() => setMessage(null), 5000);

      // Clear form
      setArtistQuery('');
      setSelectedArtist(null);
      setArtistResults([]);
      setAlbumQuery('');
      setSelectedAlbum(null);
      setAlbumResults([]);
      setIsCompilation(false);
      setGenre('');
      setTrackPad('0');
      setAlbumArtUrl('');
      setAlbumArtName('');
      setSelectedFiles([]);

      // Reset file input
      const fileInput = document.getElementById('file-input');
      if (fileInput) fileInput.value = '';
      setFilePreviews([]);

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

  const handleRetry = async (id) => {
    try {
      await apiService.retryUpload(id);
      loadRecentUploads();
      loadStats();
    } catch (error) {
      console.error('Failed to retry upload:', error);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await apiService.dismissUpload(id);
      setRecentUploads(recentUploads.filter((u) => u.id !== id));
      loadStats();
    } catch (error) {
      console.error('Failed to dismiss upload:', error);
      loadRecentUploads();
    }
  };

  const handleClearFailed = async () => {
    if (!confirm('Clear all failed uploads? This cannot be undone.')) return;
    try {
      await apiService.clearFailedUploads();
      setRecentUploads(recentUploads.filter((u) => u.status !== 'failed'));
      loadStats();
    } catch (error) {
      console.error('Failed to clear failed uploads:', error);
      loadRecentUploads();
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

  // stats.failed comes back from Postgres as a string (int8 count with no
  // pg type parser override), so a strict `=== 0` comparison never matches
  // in production. Coerce to a number once here rather than repeating the
  // fragile comparison at each call site.
  const noFailedUploads = !stats || Number(stats.failed) === 0;

  const handleArtistSearch = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (artistQuery.length < 2) return;
    setArtistSearching(true);
    try {
      const response = await apiService.searchAdminArtists(artistQuery);
      setArtistResults(response.data || []);
    } catch (err) {
      console.error('Artist search error:', err);
    } finally {
      setArtistSearching(false);
    }
  };

  const handleArtistSelect = (artist) => {
    setSelectedArtist(artist);
    setArtistQuery('');
    setArtistResults([]);
  };

  const handleArtistClear = () => {
    setSelectedArtist(null);
    setArtistQuery('');
    setArtistResults([]);
  };

  const handleAlbumSearch = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (albumQuery.length < 2) return;
    setAlbumSearching(true);
    try {
      const response = await apiService.searchAdminAlbums(albumQuery);
      setAlbumResults(response.data || []);
    } catch (err) {
      console.error('Album search error:', err);
    } finally {
      setAlbumSearching(false);
    }
  };

  const handleAlbumSelect = (album) => {
    setSelectedAlbum(album);
    setAlbumQuery('');
    setAlbumResults([]);
    setTrackPad(String(Number(album.track_count) || 0));
  };

  const handleAlbumClear = () => {
    setSelectedAlbum(null);
    setAlbumQuery('');
    setAlbumResults([]);
    setTrackPad('0');
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
          {/* File Upload */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Audio Files *
            </label>
            <input
              id="file-input"
              type="file"
              multiple
              accept=".mp3"
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
            {filePreviews.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f3f4f6' }}>
                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: '600' }}>Filename</th>
                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: '600' }}>Title</th>
                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: '600' }}>Artist</th>
                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: '600' }}>Album</th>
                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: '600' }}>#</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filePreviews.map((p, i) => {
                        const displayTitle = p.title || p.filename.replace(/\.[^.]+$/, '');
                        const isFallback = !p.title;
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.4rem 0.6rem', color: '#6b7280', fontFamily: 'monospace' }}>{p.filename}</td>
                            <td style={{ padding: '0.4rem 0.6rem', fontStyle: isFallback ? 'italic' : 'normal', color: isFallback ? '#9ca3af' : 'inherit' }}>{displayTitle}</td>
                            <td style={{ padding: '0.4rem 0.6rem', color: p.artist ? 'inherit' : '#9ca3af' }}>{p.artist || '—'}</td>
                            <td style={{ padding: '0.4rem 0.6rem', color: p.album ? 'inherit' : '#9ca3af' }}>{p.album || '—'}</td>
                            <td style={{ padding: '0.4rem 0.6rem', color: p.track ? 'inherit' : '#9ca3af' }}>{p.track || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <small style={{ color: '#6b7280', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>
                  Artist and album overrides below take precedence over these tags.
                </small>
              </div>
            )}
          </div>

          {/* Artist Picker */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Artist
            </label>
            {selectedArtist ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  padding: '0.4rem 0.75rem',
                  backgroundColor: '#e0f2fe',
                  borderRadius: '4px',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                }}>
                  {selectedArtist.name}
                </span>
                {!isCompilation && (
                  <button
                    type="button"
                    onClick={handleArtistClear}
                    aria-label="Clear artist"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1rem' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      type="text"
                      value={artistQuery}
                      onChange={(e) => { setArtistQuery(e.target.value); setArtistResults([]); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleArtistSearch(e); } }}
                      placeholder="Search by name or leave blank to use ID3 tag"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="Search artists"
                    onClick={handleArtistSearch}
                    disabled={artistSearching || artistQuery.length < 2}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      cursor: artistSearching || artistQuery.length < 2 ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {artistSearching ? 'Searching…' : 'Search'}
                  </button>
                </div>
                {artistResults.length > 0 && (
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', backgroundColor: 'white', maxHeight: '200px', overflowY: 'auto', marginBottom: '0.25rem' }}>
                    {artistResults.map((artist) => (
                      <div
                        key={artist.id}
                        onClick={() => handleArtistSelect(artist)}
                        style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #e5e7eb', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                      >
                        <span style={{ fontWeight: '500' }}>{artist.name}</span>
                        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                          {Number(artist.album_count)} album{Number(artist.album_count) !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <small style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  Optional. Leave blank to use ID3 tags, or type to search existing artists.
                </small>
              </div>
            )}
          </div>

          {/* Various Artists Compilation Toggle */}
          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isCompilation}
                onChange={(e) => setIsCompilation(e.target.checked)}
              />
              Various artists compilation
            </label>
            <small style={{ color: '#6b7280', fontSize: '0.875rem', display: 'block', marginTop: '0.25rem' }}>
              Each track gets its own artist from its file's ID3 tag. The Artist field above applies to the album only.
            </small>
          </div>

          {/* Album Picker */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Album
            </label>
            {selectedAlbum ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  padding: '0.4rem 0.75rem',
                  backgroundColor: '#e0f2fe',
                  borderRadius: '4px',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                }}>
                  {selectedAlbum.title}
                  <span style={{ fontWeight: 'normal', color: '#6b7280', marginLeft: '0.4rem' }}>
                    · {selectedAlbum.artist_name}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleAlbumClear}
                  aria-label="Clear album"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1rem' }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      type="text"
                      value={albumQuery}
                      onChange={(e) => { setAlbumQuery(e.target.value); setAlbumResults([]); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAlbumSearch(e); } }}
                      placeholder="Search by title or leave blank to use ID3 tag"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="Search albums"
                    onClick={handleAlbumSearch}
                    disabled={albumSearching || albumQuery.length < 2}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      cursor: albumSearching || albumQuery.length < 2 ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {albumSearching ? 'Searching…' : 'Search'}
                  </button>
                </div>
                {albumResults.length > 0 && (
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', backgroundColor: 'white', maxHeight: '200px', overflowY: 'auto', marginBottom: '0.25rem' }}>
                    {albumResults.map((album) => (
                      <div
                        key={album.id}
                        onClick={() => handleAlbumSelect(album)}
                        style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                      >
                        <div style={{ fontWeight: '500' }}>{album.title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {album.artist_name}{album.release_year ? ` · ${album.release_year}` : ''} · {Number(album.track_count)} track{Number(album.track_count) !== 1 ? 's' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <small style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  Optional. Leave blank to use ID3 tags, search to reuse an existing album, or type a
                  title without picking a result to override the tags and create a new album with that title.
                </small>
              </div>
            )}
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
          <div style={{ display: 'flex', gap: '0.5rem' }}>
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
            <button
              onClick={handleClearFailed}
              disabled={noFailedUploads}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: noFailedUploads ? '#d1d5db' : '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.875rem',
                cursor: noFailedUploads ? 'not-allowed' : 'pointer',
              }}
            >
              Clear All Failed
            </button>
          </div>
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
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}></th>
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
                    <td style={{ padding: '0.75rem' }}>{upload.resolved_artist_name || upload.artist_name || upload.artist_id || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {upload.resolved_album_id || upload.album_id ? (
                        <Link
                          to={`/album/${upload.resolved_album_id || upload.album_id}`}
                          style={{ color: '#3b82f6' }}
                        >
                          {upload.resolved_album_title || upload.album_name || upload.album_id}
                        </Link>
                      ) : (
                        upload.resolved_album_title || upload.album_name || '-'
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{formatDate(upload.created_at)}</td>
                    <td style={{ padding: '0.75rem', color: '#ef4444', fontSize: '0.75rem' }}>
                      {upload.error_message || '-'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {(upload.status === 'failed' || upload.status === 'processing') && (
                          <button
                            onClick={() => handleRetry(upload.id)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Retry
                          </button>
                        )}
                        {upload.status === 'failed' && (
                          <button
                            onClick={() => handleDismiss(upload.id)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              backgroundColor: '#6b7280',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
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

    </div>
  );
};

export default AdminUpload;
