// src/pages/AdminArtist.jsx
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import Loading from '../components/Loading';

const AdminArtist = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [artistData, setArtistData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [wikipedia, setWikipedia] = useState('');

  // Track if form has unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Image download state
  const [imageUrl, setImageUrl] = useState('');
  const [imageName, setImageName] = useState('');
  const [downloadingImage, setDownloadingImage] = useState(false);

  // Move artifacts state
  const [targetArtistId, setTargetArtistId] = useState('');
  const [movingArtifacts, setMovingArtifacts] = useState(false);

  // Artist search modal state (for Move Artifacts)
  const [showArtistSearchModal, setShowArtistSearchModal] = useState(false);
  const [artistSearchQuery, setArtistSearchQuery] = useState('');
  const [artistSearchResults, setArtistSearchResults] = useState([]);

  // Appears On (non-primary albums) state
  const [appearsOnAlbums, setAppearsOnAlbums] = useState([]);
  const [showAddAlbumSection, setShowAddAlbumSection] = useState(false);
  const [addAlbumQuery, setAddAlbumQuery] = useState('');
  const [addAlbumResults, setAddAlbumResults] = useState([]);
  const [addAlbumRole, setAddAlbumRole] = useState('featured');
  const [addAlbumSearching, setAddAlbumSearching] = useState(false);

  useEffect(() => {
    const fetchArtistData = async () => {
      try {
        setLoading(true);
        const response = await apiService.getArtist(id);
        const { artist } = response.data;
        setArtistData(artist);
        setName(artist.name || '');
        setImagePath(artist.image_path || '');
        setWikipedia(artist.wikipedia || '');
      } catch (error) {
        console.error('Error fetching artist data:', error);
        setError('Failed to load artist');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchArtistData();
    }
  }, [id]);

  useEffect(() => {
    const loadAppearsOn = async () => {
      try {
        const response = await apiService.getArtistSecondaryAlbums(id);
        setAppearsOnAlbums(response.data);
      } catch (error) {
        console.error('Error loading appears-on albums:', error);
      }
    };
    if (id) loadAppearsOn();
  }, [id]);

  // Track changes to form fields
  useEffect(() => {
    if (!artistData) return;

    const hasChanges =
      name !== (artistData.name || '') ||
      imagePath !== (artistData.image_path || '') ||
      wikipedia !== (artistData.wikipedia || '');

    setHasUnsavedChanges(hasChanges);
  }, [name, imagePath, wikipedia, artistData]);

  // Warn user before leaving page with unsaved changes (browser navigation)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Intercept all link clicks to check for unsaved changes
  useEffect(() => {
    const handleClick = async (e) => {
      // Only intercept if we have unsaved changes
      if (!hasUnsavedChanges) return;

      // Check if the click is on a link (or inside a link)
      const link = e.target.closest('a');
      if (!link) return;

      // Check if it's an internal navigation link (not the back link we control)
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#')) return;

      // Don't intercept our own back link
      if (link.classList.contains('admin-back-link')) return;

      // Prevent the default navigation
      e.preventDefault();
      e.stopPropagation();

      // Ask user what to do
      const choice = window.confirm('You have unsaved changes. Click OK to save and leave, or Cancel to stay on this page.');

      if (choice) {
        // User clicked OK - save and navigate
        try {
          await apiService.updateArtist(id, {
            name,
            image_path: imagePath,
            wikipedia,
          });
          setHasUnsavedChanges(false);
          // Navigate to the link destination
          setTimeout(() => navigate(href), 0);
        } catch (error) {
          console.error('Error saving artist:', error);
          setError(error.response?.data?.error || 'Failed to save artist');
        }
      }
    };

    // Add click listener to the document
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [hasUnsavedChanges, id, name, imagePath, wikipedia, navigate]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await apiService.updateArtist(id, {
        name,
        image_path: imagePath,
        wikipedia,
      });

      // Clear unsaved changes flag before navigating
      setHasUnsavedChanges(false);

      // Redirect to regular artist page after successful save
      navigate(`/artist/${id}`);
    } catch (error) {
      console.error('Error updating artist:', error);
      setError(error.response?.data?.error || 'Failed to update artist');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${artistData.name}"? This cannot be undone.`)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiService.deleteArtist(id);
      navigate('/');
    } catch (error) {
      console.error('Error deleting artist:', error);
      setError(error.response?.data?.error || 'Failed to delete artist');
      setSaving(false);
    }
  };

  const handleNavigateAway = async (destination) => {
    if (hasUnsavedChanges) {
      const choice = window.confirm('You have unsaved changes. Click OK to save and leave, or Cancel to stay on this page.');

      if (choice) {
        // User clicked OK - save and navigate
        try {
          await apiService.updateArtist(id, {
            name,
            image_path: imagePath,
            wikipedia,
          });
          setHasUnsavedChanges(false);
          navigate(destination);
        } catch (error) {
          console.error('Error saving artist:', error);
          setError(error.response?.data?.error || 'Failed to save artist');
        }
      }
      // If Cancel, do nothing (stay on page)
    } else {
      // No unsaved changes, just navigate
      navigate(destination);
    }
  };

  const handleCancel = () => {
    handleNavigateAway(`/artist/${id}`);
  };

  const handleNavigateBack = (e) => {
    e.preventDefault();
    handleNavigateAway(`/artist/${id}`);
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
      await apiService.downloadArtistImage(id, imageUrl, imageName);

      // Update the image path in the form with the newly downloaded image
      setImagePath(imageName);
      setImageUrl('');
      setImageName('');

      // Refresh artist data to get updated image_path from server
      const response = await apiService.getArtist(id);
      const { artist } = response.data;
      setArtistData(artist);
    } catch (error) {
      console.error('Error downloading image:', error);
      setError(error.response?.data?.error || 'Failed to download image');
    } finally {
      setDownloadingImage(false);
    }
  };

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
    setTargetArtistId(String(artist.id));
    setShowArtistSearchModal(false);
    setArtistSearchQuery('');
    setArtistSearchResults([]);
  };

  const handleAddAlbumSearch = async (e) => {
    e.preventDefault();
    if (addAlbumQuery.length < 2) return;
    setAddAlbumSearching(true);
    try {
      const response = await apiService.search(addAlbumQuery);
      setAddAlbumResults(response.data.albums || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setAddAlbumSearching(false);
    }
  };

  const handleAddAlbumToArtist = async (album) => {
    try {
      await apiService.addAlbumToArtist(id, album.id, addAlbumRole);
      const response = await apiService.getArtistSecondaryAlbums(id);
      setAppearsOnAlbums(response.data);
      setAddAlbumResults([]);
      setAddAlbumQuery('');
      setShowAddAlbumSection(false);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to add album');
    }
  };

  const handleRemoveAlbumFromArtist = async (albumId) => {
    if (!window.confirm('Remove this album relationship?')) return;
    try {
      await apiService.removeAlbumFromArtist(id, albumId);
      setAppearsOnAlbums(prev => prev.filter(a => a.album_id !== albumId));
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to remove album');
    }
  };

  const handleMoveArtifacts = async (e) => {
    e.preventDefault();
    if (!targetArtistId) {
      setError('Target Artist ID is required');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to move ALL albums and tracks from "${artistData.name}" (ID: ${id}) to artist ID ${targetArtistId}?\n\nThis will update all albums and tracks to belong to the new artist. This action cannot be undone.`
    );

    if (!confirmed) return;

    setMovingArtifacts(true);
    setError(null);

    try {
      const response = await apiService.moveArtistArtifacts(id, targetArtistId);
      const { albums_moved, tracks_moved } = response.data;

      alert(`Successfully moved ${albums_moved} album(s) and ${tracks_moved} track(s) to artist ID ${targetArtistId}.`);

      // Navigate to the target artist page
      navigate(`/artist/${targetArtistId}`);
    } catch (error) {
      console.error('Error moving artifacts:', error);
      setError(error.response?.data?.error || 'Failed to move artifacts');
    } finally {
      setMovingArtifacts(false);
    }
  };

  if (loading) {
    return <Loading message="Loading artist" />;
  }

  if (error && !artistData) {
    return (
      <div className="loading-container">
        <p style={{ color: '#ef4444', fontSize: '1.25rem' }}>{error}</p>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem' }}>
        <a
          href={`/artist/${id}`}
          onClick={handleNavigateBack}
          className="admin-back-link"
          style={{
            color: '#3b82f6',
            textDecoration: 'none',
            fontSize: '0.875rem'
          }}
        >
          ← Back to Artist Page
        </a>
      </div>
      <h1 style={{ marginBottom: '2rem', fontSize: '2rem' }}>Edit Artist</h1>

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
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            Image Path
          </label>
          <input
            type="text"
            value={imagePath}
            onChange={(e) => setImagePath(e.target.value)}
            placeholder="e.g., beatles.jpg"
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
              src={apiService.getImageUrl(imagePath, 'artist_page')}
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
              placeholder="beatles.jpg"
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
            placeholder="e.g., The_Beatles"
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

      {/* Move Artifacts Section */}
      <div style={{
        marginTop: '3rem',
        padding: '1.5rem',
        backgroundColor: '#fff3cd',
        borderRadius: '4px',
        border: '1px solid #ffc107'
      }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#856404' }}>
          Move All Artifacts to Another Artist
        </h3>
        <p style={{ marginBottom: '1rem', color: '#856404', fontSize: '0.875rem' }}>
          This will move ALL albums and tracks from this artist to another artist. Use this when duplicate artists were created during import.
        </p>
        <form onSubmit={handleMoveArtifacts}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#856404' }}>
              Target Artist ID
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="number"
                value={targetArtistId}
                onChange={(e) => setTargetArtistId(e.target.value)}
                placeholder="Enter artist ID to move artifacts to"
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #ffc107',
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
          </div>
          <button
            type="submit"
            disabled={movingArtifacts || !targetArtistId}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#ff8c00',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: (movingArtifacts || !targetArtistId) ? 'not-allowed' : 'pointer',
              opacity: (movingArtifacts || !targetArtistId) ? 0.6 : 1,
            }}
          >
            {movingArtifacts ? 'Moving...' : 'Move All Artifacts'}
          </button>
        </form>
      </div>

      {/* Appears On Section */}
      <div style={{
        marginTop: '3rem',
        padding: '1.5rem',
        backgroundColor: '#f0fdf4',
        borderRadius: '4px',
        border: '1px solid #86efac'
      }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#166534' }}>
          Appears On
        </h3>

        {appearsOnAlbums.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            {appearsOnAlbums.map(a => (
              <div key={a.album_id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: '1px solid #bbf7d0'
              }}>
                <span style={{ fontWeight: '500' }}>
                  {a.title}
                  {a.release_year && <span style={{ fontWeight: 'normal', color: '#6b7280', marginLeft: '0.5rem' }}>({a.release_year})</span>}
                </span>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.5rem',
                    backgroundColor: '#dcfce7',
                    borderRadius: '9999px',
                    color: '#166534'
                  }}>{a.role}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAlbumFromArtist(a.album_id)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!showAddAlbumSection ? (
          <button
            type="button"
            onClick={() => setShowAddAlbumSection(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            + Add Album
          </button>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
              <select
                value={addAlbumRole}
                onChange={(e) => setAddAlbumRole(e.target.value)}
                style={{
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #86efac',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                }}
              >
                <option value="featured">Featured</option>
                <option value="collaborator">Collaborator</option>
                <option value="compilation">Compilation</option>
                <option value="guest">Guest</option>
              </select>
              <button
                type="button"
                onClick={() => { setShowAddAlbumSection(false); setAddAlbumResults([]); setAddAlbumQuery(''); }}
                style={{
                  padding: '0.5rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
            <form onSubmit={handleAddAlbumSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <input
                type="text"
                value={addAlbumQuery}
                onChange={(e) => setAddAlbumQuery(e.target.value)}
                placeholder="Search album title..."
                autoFocus
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #86efac',
                  borderRadius: '4px',
                }}
              />
              <button
                type="submit"
                disabled={addAlbumSearching || addAlbumQuery.length < 2}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                {addAlbumSearching ? 'Searching...' : 'Search'}
              </button>
            </form>
            {addAlbumResults.length > 0 && (
              <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #86efac', borderRadius: '4px', backgroundColor: 'white' }}>
                {addAlbumResults.map(album => (
                  <div
                    key={album.id}
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderBottom: '1px solid #e5e7eb',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: '500' }}>{album.title}</span>
                      {album.artist && <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: '0.5rem' }}>by {album.artist.name}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddAlbumToArtist(album)}
                      style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: '#16a34a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Add as {addAlbumRole}
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                      <span style={{ fontWeight: '500' }}>{artist.name}</span>
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

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowArtistSearchModal(false)}
                style={{
                  padding: '0.5rem 1.5rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminArtist;
