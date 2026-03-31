// src/pages/AdminArtist.jsx
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import Loading from '../components/Loading';
import toast from 'react-hot-toast';

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
  const [movingArtifacts, setMovingArtifacts] = useState(false);
  const [moveArtistQuery, setMoveArtistQuery] = useState('');
  const [moveArtistResults, setMoveArtistResults] = useState([]);
  const [moveArtistSearching, setMoveArtistSearching] = useState(false);
  const [selectedTargetArtist, setSelectedTargetArtist] = useState(null);

  // Related artists state
  const [relatedArtists, setRelatedArtists] = useState([]);

  // Unified relations add form state
  const [showAddRelationSection, setShowAddRelationSection] = useState(false);
  const [relationTypeToAdd, setRelationTypeToAdd] = useState('related_artist');
  const [addRelationQuery, setAddRelationQuery] = useState('');
  const [addRelationResults, setAddRelationResults] = useState([]);
  const [addRelationSearching, setAddRelationSearching] = useState(false);
  const [addRelationRole, setAddRelationRole] = useState('featured');

  // Appears On (non-primary albums) state
  const [appearsOnAlbums, setAppearsOnAlbums] = useState([]);

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

  useEffect(() => {
    const loadRelatedArtists = async () => {
      try {
        const response = await apiService.getRelatedArtists(id);
        setRelatedArtists(response.data);
      } catch (error) {
        console.error('Error loading related artists:', error);
      }
    };
    if (id) loadRelatedArtists();
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

  const handleMoveArtistSearch = async (e) => {
    e.preventDefault();
    if (moveArtistQuery.length < 2) return;
    setMoveArtistSearching(true);
    try {
      const response = await apiService.search(moveArtistQuery);
      setMoveArtistResults((response.data.artists || []).filter(a => String(a.id) !== String(id)));
    } catch (error) {
      console.error('Error searching artists:', error);
    } finally {
      setMoveArtistSearching(false);
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

  const handleAddRelationSearch = async (e) => {
    e.preventDefault();
    if (addRelationQuery.length < 2) return;
    setAddRelationSearching(true);
    try {
      const response = await apiService.search(addRelationQuery);
      if (relationTypeToAdd === 'related_artist' || relationTypeToAdd === 'member') {
        setAddRelationResults((response.data.artists || []).filter(a => String(a.id) !== String(id)));
      } else {
        setAddRelationResults(response.data.albums || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setAddRelationSearching(false);
    }
  };

  const handleAddRelation = async (item) => {
    try {
      if (relationTypeToAdd === 'related_artist' || relationTypeToAdd === 'member') {
        const kind = relationTypeToAdd === 'member' ? 'member' : 'related';
        await apiService.addRelatedArtist(id, item.id, kind);
        const response = await apiService.getRelatedArtists(id);
        setRelatedArtists(response.data);
      } else {
        await apiService.addAlbumToArtist(id, item.id, addRelationRole);
        const response = await apiService.getArtistSecondaryAlbums(id);
        setAppearsOnAlbums(response.data);
      }
      setAddRelationResults([]);
      setAddRelationQuery('');
      setShowAddRelationSection(false);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to add relation');
    }
  };

  const handleRemoveRelatedArtist = async (relatedArtistId) => {
    if (!window.confirm('Remove this related artist?')) return;
    try {
      await apiService.removeRelatedArtist(id, relatedArtistId);
      setRelatedArtists(prev => prev.filter(ra => ra.id !== relatedArtistId));
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to remove related artist');
    }
  };

  const handleMoveArtifacts = async (e) => {
    e.preventDefault();
    if (!selectedTargetArtist) return;

    const confirmed = window.confirm(
      `Are you sure you want to move ALL albums and tracks from "${artistData.name}" to "${selectedTargetArtist.name}"?\n\nThis will update all albums and tracks to belong to the new artist. This action cannot be undone.`
    );

    if (!confirmed) return;

    setMovingArtifacts(true);
    setError(null);

    try {
      const response = await apiService.moveArtistArtifacts(id, selectedTargetArtist.id);
      const { albums_moved, tracks_moved } = response.data;

      toast.success(`Moved ${albums_moved} album(s) and ${tracks_moved} track(s) to "${selectedTargetArtist.name}".`);

      navigate(`/artist/${selectedTargetArtist.id}`);
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

      {/* Relations Section */}
      <div style={{
        marginTop: '3rem',
        padding: '1.5rem',
        backgroundColor: '#f0fdf4',
        borderRadius: '4px',
        border: '1px solid #86efac'
      }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#166534' }}>
          Relations
        </h3>

        {/* Members */}
        {relatedArtists.filter(r => r.kind === 'member').length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#166534', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Members
            </div>
            {relatedArtists.filter(r => r.kind === 'member').map(ra => (
              <div key={ra.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: '1px solid #bbf7d0'
              }}>
                <span
                  style={{ fontWeight: '500', color: '#7c3aed', cursor: 'pointer' }}
                  onClick={() => navigate(`/artist/${ra.id}`)}
                >
                  {ra.name}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveRelatedArtist(ra.id)}
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
            ))}
          </div>
        )}

        {/* Related Artists */}
        {relatedArtists.filter(r => r.kind === 'related').length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#166534', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Related Artists
            </div>
            {relatedArtists.filter(r => r.kind === 'related').map(ra => (
              <div key={ra.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: '1px solid #bbf7d0'
              }}>
                <span
                  style={{ fontWeight: '500', color: '#7c3aed', cursor: 'pointer' }}
                  onClick={() => navigate(`/artist/${ra.id}`)}
                >
                  {ra.name}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveRelatedArtist(ra.id)}
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
            ))}
          </div>
        )}

        {/* Appears On Albums */}
        {appearsOnAlbums.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#166534', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Appears On
            </div>
            {appearsOnAlbums.map(a => (
              <div key={a.album_id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: '1px solid #bbf7d0'
              }}>
                <span style={{ fontWeight: '500' }}>
                  <span
                    style={{ color: '#7c3aed', cursor: 'pointer' }}
                    onClick={() => navigate(`/album/${a.album_id}`)}
                  >{a.title}</span>
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

        {/* Add Relation Form */}
        {!showAddRelationSection ? (
          <button
            type="button"
            onClick={() => setShowAddRelationSection(true)}
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
            + Add Relation
          </button>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
              <select
                value={relationTypeToAdd}
                onChange={(e) => {
                  setRelationTypeToAdd(e.target.value);
                  setAddRelationResults([]);
                  setAddRelationQuery('');
                }}
                style={{
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #86efac',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                }}
              >
                <option value="related_artist">Related Artist</option>
                <option value="member">Member</option>
                <option value="appears_on">Appears On Album</option>
              </select>
              {relationTypeToAdd === 'appears_on' && (
                <select
                  value={addRelationRole}
                  onChange={(e) => setAddRelationRole(e.target.value)}
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
              )}
              <button
                type="button"
                onClick={() => {
                  setShowAddRelationSection(false);
                  setAddRelationResults([]);
                  setAddRelationQuery('');
                }}
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
            <form onSubmit={handleAddRelationSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <input
                type="text"
                value={addRelationQuery}
                onChange={(e) => setAddRelationQuery(e.target.value)}
                placeholder={relationTypeToAdd === 'appears_on' ? 'Search album title...' : 'Search artist name...'}
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
                disabled={addRelationSearching || addRelationQuery.length < 2}
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
                {addRelationSearching ? 'Searching...' : 'Search'}
              </button>
            </form>
            {addRelationResults.length > 0 && (
              <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #86efac', borderRadius: '4px', backgroundColor: 'white' }}>
                {addRelationResults.map(item => (
                  <div
                    key={item.id}
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderBottom: '1px solid #e5e7eb',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: '500' }}>{item.name || item.title}</span>
                      {item.artist && <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: '0.5rem' }}>by {item.artist.name}</span>}
                      {(relationTypeToAdd === 'related_artist' || relationTypeToAdd === 'member') && (
                        <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: '0.5rem' }}>{item.album_count} album{item.album_count !== 1 ? 's' : ''} · ID {item.id}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddRelation(item)}
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
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
        <form onSubmit={handleMoveArtistSearch} style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={moveArtistQuery}
              onChange={(e) => {
                setMoveArtistQuery(e.target.value);
                setSelectedTargetArtist(null);
                setMoveArtistResults([]);
              }}
              placeholder="Search for target artist..."
              style={{
                flex: 1,
                padding: '0.5rem',
                fontSize: '1rem',
                border: '1px solid #ffc107',
                borderRadius: '4px',
              }}
            />
            <button
              type="submit"
              disabled={moveArtistSearching || moveArtistQuery.length < 2}
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
              {moveArtistSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
        {moveArtistResults.length > 0 && !selectedTargetArtist && (
          <div style={{ marginBottom: '1rem', border: '1px solid #ffc107', borderRadius: '4px', backgroundColor: 'white', maxHeight: '200px', overflowY: 'auto' }}>
            {moveArtistResults.map(artist => (
              <div
                key={artist.id}
                onClick={() => {
                  setSelectedTargetArtist(artist);
                  setMoveArtistResults([]);
                }}
                style={{
                  padding: '0.6rem 0.75rem',
                  borderBottom: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fefce8')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
              >
                <span style={{ fontWeight: '500' }}>{artist.name}</span>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{artist.album_count} album{artist.album_count !== 1 ? 's' : ''} · ID {artist.id}</span>
              </div>
            ))}
          </div>
        )}
        {selectedTargetArtist && (
          <p style={{ marginBottom: '1rem', color: '#856404', fontSize: '0.875rem' }}>
            Target: <strong>{selectedTargetArtist.name}</strong>
            <button
              type="button"
              onClick={() => { setSelectedTargetArtist(null); setMoveArtistQuery(''); }}
              style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              ✕
            </button>
          </p>
        )}
        <form onSubmit={handleMoveArtifacts}>
          <button
            type="submit"
            disabled={movingArtifacts || !selectedTargetArtist}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#ff8c00',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: (movingArtifacts || !selectedTargetArtist) ? 'not-allowed' : 'pointer',
              opacity: (movingArtifacts || !selectedTargetArtist) ? 0.6 : 1,
            }}
          >
            {movingArtifacts ? 'Moving...' : 'Move All Artifacts'}
          </button>
        </form>
      </div>

    </div>
  );
};

export default AdminArtist;
