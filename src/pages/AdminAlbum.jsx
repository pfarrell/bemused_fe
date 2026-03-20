// src/pages/AdminAlbum.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import Loading from '../components/Loading';

const AdminAlbum = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [albumData, setAlbumData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [artistId, setArtistId] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [wikipedia, setWikipedia] = useState('');

  // Image download state
  const [imageUrl, setImageUrl] = useState('');
  const [imageName, setImageName] = useState('');
  const [downloadingImage, setDownloadingImage] = useState(false);

  // Tracks state
  const [tracks, setTracks] = useState([]);
  const [trackChanges, setTrackChanges] = useState({});

  // Bulk update state
  const [bulkAlbumId, setBulkAlbumId] = useState('');
  const [bulkArtistId, setBulkArtistId] = useState('');

  useEffect(() => {
    const fetchAlbumData = async () => {
      try {
        setLoading(true);
        const response = await apiService.getAlbum(id);
        const { album, artist, tracks } = response.data;
        setAlbumData({ album, artist });
        setTitle(album.title || '');
        setArtistId(String(album.artist_id) || '');
        setReleaseYear(album.release_year || '');
        setImagePath(album.image_path || '');
        setWikipedia(album.wikipedia || '');
        setTracks(tracks || []);
        setBulkAlbumId(String(album.id) || '');
        setBulkArtistId(String(album.artist_id) || '');
      } catch (error) {
        console.error('Error fetching album data:', error);
        setError('Failed to load album');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchAlbumData();
    }
  }, [id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await apiService.updateAlbum(id, {
        title,
        artist_id: parseInt(artistId),
        release_year: releaseYear,
        image_path: imagePath,
        wikipedia,
      });

      // Redirect to regular album page after successful save
      navigate(`/album/${id}`);
    } catch (error) {
      console.error('Error updating album:', error);
      setError(error.response?.data?.error || 'Failed to update album');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${albumData?.album?.title}"? This cannot be undone.`)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiService.deleteAlbum(id);
      navigate('/');
    } catch (error) {
      console.error('Error deleting album:', error);
      setError(error.response?.data?.error || 'Failed to delete album');
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/album/${id}`);
  };

  const handleDownloadImage = async (e) => {
    e.preventDefault();
    if (!imageUrl || !imageName) {
      setError('Both Image URL and Image Name are required');
      return;
    }

    setDownloadingImage(true);
    setError(null);

    try {
      const response = await apiService.downloadAlbumImage(id, imageUrl, imageName);
      // Update the image path in the form with the newly downloaded image
      setImagePath(imageName);
      setImageUrl('');
      setImageName('');
      alert('Image downloaded and saved successfully!');
    } catch (error) {
      console.error('Error downloading image:', error);
      setError(error.response?.data?.error || 'Failed to download image');
    } finally {
      setDownloadingImage(false);
    }
  };

  // Track editing handlers
  const handleTrackFieldChange = (trackId, field, value) => {
    setTrackChanges(prev => ({
      ...prev,
      [trackId]: {
        ...prev[trackId],
        [field]: value,
        dirty: true
      }
    }));
  };

  const handleTrackBlur = async (trackId, field) => {
    const changes = trackChanges[trackId];
    if (!changes || !changes.dirty) return;

    try {
      const updateData = {};
      Object.keys(changes).forEach(key => {
        if (key !== 'dirty') {
          updateData[key] = changes[key];
        }
      });

      await apiService.updateTrack(trackId, updateData);

      // Update the track in local state
      setTracks(prevTracks =>
        prevTracks.map(t =>
          t.id === trackId ? { ...t, ...updateData } : t
        )
      );

      // Clear the changes for this track
      setTrackChanges(prev => {
        const newChanges = { ...prev };
        delete newChanges[trackId];
        return newChanges;
      });
    } catch (error) {
      console.error('Error updating track:', error);
      alert('Failed to update track: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteTrack = async (trackId) => {
    if (!window.confirm('Are you sure you want to delete this track?')) {
      return;
    }

    try {
      await apiService.deleteTrack(trackId);
      setTracks(prevTracks => prevTracks.filter(t => t.id !== trackId));
    } catch (error) {
      console.error('Error deleting track:', error);
      alert('Failed to delete track: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleBulkUpdate = async () => {
    try {
      const updateData = {};

      if (bulkAlbumId) {
        updateData.album_id = parseInt(bulkAlbumId);
      }

      if (bulkArtistId) {
        updateData.artist_id = parseInt(bulkArtistId);
      }

      if (Object.keys(updateData).length === 0) {
        alert('Please specify at least one field to update');
        return;
      }

      await apiService.bulkUpdateTracks(id, updateData);

      // Refresh the album data to show updated tracks
      const response = await apiService.getAlbum(id);
      const { tracks } = response.data;
      setTracks(tracks || []);

      alert('All tracks updated successfully!');
    } catch (error) {
      console.error('Error bulk updating tracks:', error);
      alert('Failed to bulk update tracks: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading) {
    return <Loading message="Loading album" />;
  }

  if (error && !albumData) {
    return (
      <div className="loading-container">
        <p style={{ color: '#ef4444', fontSize: '1.25rem' }}>{error}</p>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '2rem' }}>Edit Album</h1>

      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: '#fee',
          color: '#c00',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSave}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Artist ID *
          </label>
          <input
            type="number"
            value={artistId}
            onChange={(e) => setArtistId(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
          <small style={{ color: '#666', fontSize: '0.875rem' }}>
            Current artist: {albumData?.artist?.name}
          </small>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Release Year
          </label>
          <input
            type="text"
            value={releaseYear}
            onChange={(e) => setReleaseYear(e.target.value)}
            placeholder="e.g., 1969"
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Image Path
          </label>
          <input
            type="text"
            value={imagePath}
            onChange={(e) => setImagePath(e.target.value)}
            placeholder="e.g., abbey_road.jpg"
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
          {imagePath && (
            <img
              src={apiService.getImageUrl(imagePath, 'album_page')}
              alt="Preview"
              style={{ marginTop: '0.5rem', maxWidth: '200px', borderRadius: '4px' }}
            />
          )}
        </div>

        {/* Image Download Section */}
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: '#f9fafb',
          borderRadius: '4px',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Download Image from URL
          </h3>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Image URL
            </label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '1rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Save as Filename
            </label>
            <input
              type="text"
              value={imageName}
              onChange={(e) => setImageName(e.target.value)}
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
          <button
            onClick={handleDownloadImage}
            disabled={downloadingImage || !imageUrl || !imageName}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.875rem',
              cursor: (downloadingImage || !imageUrl || !imageName) ? 'not-allowed' : 'pointer',
              opacity: (downloadingImage || !imageUrl || !imageName) ? 0.6 : 1,
            }}
          >
            {downloadingImage ? 'Downloading...' : 'Download & Save Image'}
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Wikipedia Slug
          </label>
          <input
            type="text"
            value={wikipedia}
            onChange={(e) => setWikipedia(e.target.value)}
            placeholder="e.g., Abbey_Road"
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
          <small style={{ color: '#666', fontSize: '0.875rem' }}>
            The part after wikipedia.org/wiki/
          </small>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              marginLeft: 'auto',
            }}
          >
            Delete
          </button>
        </div>
      </form>

      {/* Bulk Update Section */}
      {tracks && tracks.length > 0 && (
        <div style={{ marginTop: '3rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Update All Tracks
          </h2>
          <div style={{
            padding: '1rem',
            backgroundColor: '#f9fafb',
            borderRadius: '4px',
            border: '1px solid #e5e7eb'
          }}>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              Use this to change the album or artist for all tracks at once. This is useful for compilation albums or fixing batch imports.
            </p>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem' }}>
                  Album ID
                </label>
                <input
                  type="number"
                  value={bulkAlbumId}
                  onChange={(e) => setBulkAlbumId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '1rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem' }}>
                  Artist ID
                </label>
                <input
                  type="number"
                  value={bulkArtistId}
                  onChange={(e) => setBulkArtistId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '1rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                  }}
                />
              </div>
              <button
                onClick={handleBulkUpdate}
                style={{
                  padding: '0.5rem 1.5rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  fontWeight: '500',
                  whiteSpace: 'nowrap'
                }}
              >
                Update All Tracks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tracks Section */}
      {tracks && tracks.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Individual Tracks
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.875rem'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>Track #</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>Title</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>Album ID</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>Artist ID</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>Duration</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tracks.sort((a, b) => (parseInt(a.track_number) || 0) - (parseInt(b.track_number) || 0)).map((track) => {
                  const currentChanges = trackChanges[track.id] || {};
                  return (
                    <tr key={track.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <input
                          type="text"
                          defaultValue={track.track_number || ''}
                          onFocus={(e) => e.target.dataset.originalValue = e.target.value}
                          onChange={(e) => handleTrackFieldChange(track.id, 'track_number', e.target.value)}
                          onBlur={(e) => {
                            if (e.target.value !== e.target.dataset.originalValue) {
                              handleTrackBlur(track.id, 'track_number');
                            }
                          }}
                          style={{
                            width: '60px',
                            padding: '0.25rem 0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <input
                          type="text"
                          defaultValue={track.title || ''}
                          onFocus={(e) => e.target.dataset.originalValue = e.target.value}
                          onChange={(e) => handleTrackFieldChange(track.id, 'title', e.target.value)}
                          onBlur={(e) => {
                            if (e.target.value !== e.target.dataset.originalValue) {
                              handleTrackBlur(track.id, 'title');
                            }
                          }}
                          style={{
                            width: '100%',
                            minWidth: '200px',
                            padding: '0.25rem 0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <input
                          type="number"
                          defaultValue={track.album.id || ''}
                          onFocus={(e) => e.target.dataset.originalValue = e.target.value}
                          onChange={(e) => handleTrackFieldChange(track.id, 'album_id', parseInt(e.target.value))}
                          onBlur={(e) => {
                            if (e.target.value !== e.target.dataset.originalValue) {
                              handleTrackBlur(track.id, 'album_id');
                            }
                          }}
                          style={{
                            width: '80px',
                            padding: '0.25rem 0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <input
                          type="number"
                          defaultValue={track.artist.id || ''}
                          onFocus={(e) => e.target.dataset.originalValue = e.target.value}
                          onChange={(e) => handleTrackFieldChange(track.id, 'artist_id', parseInt(e.target.value))}
                          onBlur={(e) => {
                            if (e.target.value !== e.target.dataset.originalValue) {
                              handleTrackBlur(track.id, 'artist_id');
                            }
                          }}
                          style={{
                            width: '80px',
                            padding: '0.25rem 0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                        {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : '-'}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteTrack(track.id)}
                          style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAlbum;
