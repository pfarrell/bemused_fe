// src/pages/AdminAlbum.jsx
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import Loading from '../components/Loading';
import toast from 'react-hot-toast';

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
  const [musicbrainzId, setMusicbrainzId] = useState('');
  const [mbidStatus, setMbidStatus] = useState('');

  // Track if form has unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Image gallery state
  const [images, setImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageName, setNewImageName] = useState('');
  const [addingImage, setAddingImage] = useState(false);

  // Tracks state
  const [tracks, setTracks] = useState([]);
  const [trackChanges, setTrackChanges] = useState({});

  // Transfer section (move to artist / merge into album)
  const [transferMode, setTransferMode] = useState('move'); // 'move' | 'merge'
  const [transferQuery, setTransferQuery] = useState('');
  const [transferResults, setTransferResults] = useState([]);
  const [transferSearching, setTransferSearching] = useState(false);
  const [targetArtistId, setTargetArtistId] = useState('');
  const [selectedArtistName, setSelectedArtistName] = useState('');
  const [movingToArtist, setMovingToArtist] = useState(false);
  const [mergeDestAlbum, setMergeDestAlbum] = useState(null);
  const [mergeOffset, setMergeOffset] = useState('');
  const [mergingAlbum, setMergingAlbum] = useState(false);

  // Secondary artists state
  const [secondaryArtists, setSecondaryArtists] = useState([]);
  const [showAddArtistSection, setShowAddArtistSection] = useState(false);
  const [addArtistQuery, setAddArtistQuery] = useState('');
  const [addArtistResults, setAddArtistResults] = useState([]);
  const [addArtistRole, setAddArtistRole] = useState('featured');
  const [addArtistSearching, setAddArtistSearching] = useState(false);

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
        setMusicbrainzId(album.musicbrainz_id || '');
        setMbidStatus(album.mbid_status || '');
        setTracks(tracks || []);
        const imagesRes = await apiService.getAlbumImages(id);
        setImages(imagesRes.data);
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

  useEffect(() => {
    const loadSecondaryArtists = async () => {
      try {
        const response = await apiService.getAlbumSecondaryArtists(id);
        setSecondaryArtists(response.data);
      } catch (error) {
        console.error('Error loading secondary artists:', error);
      }
    };
    if (id) loadSecondaryArtists();
  }, [id]);

  // Track changes to form fields
  useEffect(() => {
    if (!albumData?.album) return;

    const album = albumData.album;
    const hasChanges =
      title !== (album.title || '') ||
      artistId !== String(album.artist_id || '') ||
      releaseYear !== (album.release_year || '') ||
      imagePath !== (album.image_path || '') ||
      wikipedia !== (album.wikipedia || '');

    setHasUnsavedChanges(hasChanges);
  }, [title, artistId, releaseYear, imagePath, wikipedia, albumData]);

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
          await apiService.updateAlbum(id, {
            title,
            artist_id: parseInt(artistId),
            release_year: releaseYear,
            image_path: imagePath,
            wikipedia,
          });
          setHasUnsavedChanges(false);
          // Navigate to the link destination
          setTimeout(() => navigate(href), 0);
        } catch (error) {
          console.error('Error saving album:', error);
          setError(error.response?.data?.error || 'Failed to save album');
        }
      }
    };

    // Add click listener to the document
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [hasUnsavedChanges, id, title, artistId, releaseYear, imagePath, wikipedia, navigate]);

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

      // Clear unsaved changes flag before navigating
      setHasUnsavedChanges(false);

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

  const handleNavigateAway = async (destination) => {
    if (hasUnsavedChanges) {
      const choice = window.confirm('You have unsaved changes. Click OK to save and leave, or Cancel to stay on this page.');

      if (choice) {
        // User clicked OK - save and navigate
        try {
          await apiService.updateAlbum(id, {
            title,
            artist_id: parseInt(artistId),
            release_year: releaseYear,
            image_path: imagePath,
            wikipedia,
          });
          setHasUnsavedChanges(false);
          navigate(destination);
        } catch (error) {
          console.error('Error saving album:', error);
          setError(error.response?.data?.error || 'Failed to save album');
        }
      }
      // If Cancel, do nothing (stay on page)
    } else {
      // No unsaved changes, just navigate
      navigate(destination);
    }
  };

  const handleCancel = () => {
    handleNavigateAway(`/album/${id}`);
  };

  const handleNavigateBack = (e) => {
    e.preventDefault();
    handleNavigateAway(`/album/${id}`);
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

  const handleTransferModeChange = (mode) => {
    setTransferMode(mode);
    setTransferQuery('');
    setTransferResults([]);
    setTargetArtistId('');
    setSelectedArtistName('');
    setMergeDestAlbum(null);
    setMergeOffset('');
  };

  const handleTransferSearch = async (e) => {
    e.preventDefault();
    if (transferQuery.length < 2) return;
    setTransferSearching(true);
    try {
      const response = await apiService.search(transferQuery);
      if (transferMode === 'move') {
        const currentArtistId = albumData?.album?.artist_id;
        setTransferResults((response.data.artists || []).filter(a => a.id !== currentArtistId));
      } else {
        const currentArtistId = albumData?.album?.artist_id;
        const filtered = (response.data.albums || []).filter(a => String(a.id) !== String(id));
        filtered.sort((a, b) => {
          const aIsSame = a.artist_id === currentArtistId || a.artist?.id === currentArtistId;
          const bIsSame = b.artist_id === currentArtistId || b.artist?.id === currentArtistId;
          if (aIsSame && !bIsSame) return -1;
          if (!aIsSame && bIsSame) return 1;
          return 0;
        });
        setTransferResults(filtered);
      }
    } catch (error) {
      console.error('Transfer search error:', error);
    } finally {
      setTransferSearching(false);
    }
  };

  const handleSelectTransferResult = async (item) => {
    setTransferResults([]);
    setTransferQuery('');
    if (transferMode === 'move') {
      setTargetArtistId(String(item.id));
      setSelectedArtistName(item.name);
    } else {
      setMergeDestAlbum(item);
      const maxTrackNum = item.track_count ? parseInt(item.track_count) : 0;
      setMergeOffset(String(maxTrackNum));
    }
  };

  const handleMergeAlbum = async () => {
    if (!mergeDestAlbum) return;
    const offset = parseInt(mergeOffset) || 0;
    const confirmed = window.confirm(
      `Merge "${albumData?.album?.title}" into "${mergeDestAlbum.title}"?\n\n` +
      (offset > 0 ? `Track numbers will be incremented by ${offset}.\n\n` : 'Track numbers will not be changed.\n\n') +
      `This album will be deleted after the merge. This cannot be undone.`
    );
    if (!confirmed) return;
    setMergingAlbum(true);
    try {
      const response = await apiService.mergeAlbum(id, mergeDestAlbum.id, offset);
      const { tracks_moved } = response.data;
      toast.success(`Merged ${tracks_moved} track(s) into "${mergeDestAlbum.title}".`);
      navigate(`/admin/album/${mergeDestAlbum.id}`);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to merge album');
    } finally {
      setMergingAlbum(false);
    }
  };

  const handleAddArtistSearch = async (e) => {
    e.preventDefault();
    if (addArtistQuery.length < 2) return;
    setAddArtistSearching(true);
    try {
      const response = await apiService.search(addArtistQuery);
      const primaryArtistId = albumData?.album?.artist_id;
      setAddArtistResults((response.data.artists || []).filter(a => a.id !== primaryArtistId));
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setAddArtistSearching(false);
    }
  };

  const handleAddArtistToAlbum = async (artist) => {
    try {
      await apiService.addArtistToAlbum(id, artist.id, addArtistRole);
      const response = await apiService.getAlbumSecondaryArtists(id);
      setSecondaryArtists(response.data);
      setAddArtistResults([]);
      setAddArtistQuery('');
      setShowAddArtistSection(false);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to add artist');
    }
  };

  const handleRemoveArtistFromAlbum = async (artistId) => {
    if (!window.confirm('Remove this artist from the album?')) return;
    try {
      await apiService.removeArtistFromAlbum(id, artistId);
      setSecondaryArtists(prev => prev.filter(a => a.artist_id !== artistId));
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to remove artist');
    }
  };

  const handleMoveToArtist = async () => {
    if (!targetArtistId) {
      setError('Target Artist ID is required');
      return;
    }

    const confirmed = window.confirm(
      `Move "${albumData?.album?.title}" and ALL its tracks to ${selectedArtistName || `artist ID ${targetArtistId}`}?\n\nThis will update the album and all tracks to belong to the new artist. This cannot be undone.`
    );

    if (!confirmed) return;

    setMovingToArtist(true);
    setError(null);

    try {
      const response = await apiService.moveAlbumToArtist(id, targetArtistId);
      const { tracks_moved } = response.data;
      toast.success(`Moved album and ${tracks_moved} track(s) to ${selectedArtistName}.`);
      navigate(`/album/${id}`);
    } catch (error) {
      console.error('Error moving album:', error);
      setError(error.response?.data?.error || 'Failed to move album');
    } finally {
      setMovingToArtist(false);
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
      <div style={{ marginBottom: '1rem' }}>
        <a
          href={`/album/${id}`}
          onClick={handleNavigateBack}
          className="admin-back-link"
          style={{
            color: '#3b82f6',
            textDecoration: 'none',
            fontSize: '0.875rem'
          }}
        >
          ← Back to Album Page
        </a>
      </div>
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

        {/* Image Gallery */}
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem' }}>Images</h3>

          {loadingImages ? (
            <p>Loading images...</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              {images.map(img => (
                <div key={img.id} style={{
                  border: img.is_primary ? '2px solid #4ade80' : '2px solid #444',
                  borderRadius: '8px',
                  padding: '8px',
                  width: '120px',
                }}>
                  <img
                    src={apiService.getImageUrl(img.path, 'album_page')}
                    alt=""
                    style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }}
                  />
                  <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>{img.source}</div>
                  {img.status === 'proposed' && (
                    <div style={{ fontSize: '11px', color: '#facc15' }}>proposed</div>
                  )}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                    {!img.is_primary && (
                      <button
                        onClick={async () => {
                          await apiService.setAlbumImagePrimary(id, img.id);
                          const res = await apiService.getAlbumImages(id);
                          setImages(res.data);
                          setImagePath(img.path);
                        }}
                        style={{ fontSize: '11px', padding: '2px 6px' }}
                      >
                        Set Primary
                      </button>
                    )}
                    {img.is_primary && (
                      <span style={{ fontSize: '11px', color: '#4ade80' }}>✓ Primary</span>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm('Delete this image?')) return;
                        await apiService.deleteAlbumImage(id, img.id);
                        setImages(images.filter(i => i.id !== img.id));
                      }}
                      style={{ fontSize: '11px', padding: '2px 6px', color: '#f87171' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold', fontSize: '0.875rem' }}>Image URL</label>
              <input
                type="text"
                value={newImageUrl}
                onChange={e => setNewImageUrl(e.target.value)}
                placeholder="https://..."
                style={{ width: '300px', padding: '0.5rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold', fontSize: '0.875rem' }}>File name</label>
              <input
                type="text"
                value={newImageName}
                onChange={e => setNewImageName(e.target.value)}
                placeholder="album_123.jpg"
                style={{ padding: '0.5rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <button
              onClick={async () => {
                if (!newImageUrl || !newImageName) return;
                setAddingImage(true);
                try {
                  await apiService.addAlbumImage(id, newImageUrl, newImageName, images.length === 0);
                  const res = await apiService.getAlbumImages(id);
                  setImages(res.data);
                  setNewImageUrl('');
                  setNewImageName('');
                } finally {
                  setAddingImage(false);
                }
              }}
              disabled={addingImage || !newImageUrl || !newImageName}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.875rem',
                cursor: (addingImage || !newImageUrl || !newImageName) ? 'not-allowed' : 'pointer',
                opacity: (addingImage || !newImageUrl || !newImageName) ? 0.6 : 1,
              }}
            >
              {addingImage ? 'Adding...' : 'Add Image'}
            </button>
          </div>
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

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            MusicBrainz
          </label>
          {musicbrainzId ? (
            <a
              href={`https://musicbrainz.org/release/${musicbrainzId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#3b82f6', fontSize: '0.875rem', wordBreak: 'break-all' }}
            >
              {musicbrainzId}
            </a>
          ) : (
            <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              {mbidStatus === 'not_found' ? 'Not found on MusicBrainz' : mbidStatus === 'low_confidence' ? 'Low confidence match' : 'Not yet looked up'}
            </span>
          )}
          {mbidStatus && (
            <small style={{ display: 'block', color: '#9ca3af', marginTop: '0.25rem' }}>
              Status: {mbidStatus}
            </small>
          )}
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

      {/* Transfer Section — Move to Artist or Merge into Album */}
      <div style={{ marginTop: '3rem', padding: '1.5rem', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#856404' }}>
          Transfer Album
        </h3>

        <div style={{ marginBottom: '1rem' }}>
          <select
            value={transferMode}
            onChange={e => handleTransferModeChange(e.target.value)}
            style={{ padding: '0.5rem', fontSize: '1rem', border: '1px solid #ffc107', borderRadius: '4px', backgroundColor: 'white', color: '#856404', cursor: 'pointer' }}
          >
            <option value="move">Move to another artist</option>
            <option value="merge">Merge into another album</option>
          </select>
        </div>

        <p style={{ marginBottom: '0.75rem', color: '#856404', fontSize: '0.875rem' }}>
          {transferMode === 'move'
            ? 'Moves this album and all its tracks to another artist.'
            : 'Moves all tracks into another album, then deletes this album. Use for consolidating multi-disc albums.'}
        </p>

        <form onSubmit={handleTransferSearch} style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={transferQuery}
              onChange={e => setTransferQuery(e.target.value)}
              placeholder={transferMode === 'move' ? 'Search for artist...' : 'Search for destination album...'}
              style={{ flex: 1, padding: '0.5rem', fontSize: '1rem', border: '1px solid #ffc107', borderRadius: '4px' }}
            />
            <button
              type="submit"
              disabled={transferSearching}
              style={{ padding: '0.5rem 1rem', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {transferSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {transferResults.length > 0 && (
          <div style={{ border: '1px solid #ffc107', borderRadius: '4px', marginBottom: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}>
            {transferResults.map(item => (
              <div
                key={item.id}
                onClick={() => handleSelectTransferResult(item)}
                style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef9c3'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
              >
                <span>{item.name || item.title}</span>
                <span style={{ fontSize: '0.8rem', color: '#92400e' }}>
                  {transferMode === 'move'
                    ? `${item.album_count != null ? `${item.album_count} albums` : ''}`
                    : `${item.artist?.name}${item.track_count != null ? ` · ${item.track_count} tracks` : ''}`}
                </span>
              </div>
            ))}
          </div>
        )}

        {transferMode === 'move' && selectedArtistName && (
          <p style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#856404' }}>
            Selected: <strong>{selectedArtistName}</strong>
          </p>
        )}

        {transferMode === 'merge' && mergeDestAlbum && (
          <div style={{ marginBottom: '0.75rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#856404', marginBottom: '0.5rem' }}>
              Destination: <strong>{mergeDestAlbum.title}</strong>
              {mergeDestAlbum.artist?.name && <span> — {mergeDestAlbum.artist.name}</span>}
              {mergeDestAlbum.track_count != null && <span> ({mergeDestAlbum.track_count} tracks)</span>}
            </p>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#856404', marginBottom: '0.25rem' }}>
              Track number offset (0 = no change):
            </label>
            <input
              type="number"
              value={mergeOffset}
              onChange={e => setMergeOffset(e.target.value)}
              min="0"
              style={{ width: '100px', padding: '0.4rem', fontSize: '1rem', border: '1px solid #ffc107', borderRadius: '4px' }}
            />
          </div>
        )}

        <button
          onClick={transferMode === 'move' ? handleMoveToArtist : handleMergeAlbum}
          disabled={transferMode === 'move' ? (movingToArtist || !targetArtistId) : (mergingAlbum || !mergeDestAlbum)}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#ff8c00',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor: 'pointer',
            opacity: (transferMode === 'move' ? (movingToArtist || !targetArtistId) : (mergingAlbum || !mergeDestAlbum)) ? 0.6 : 1,
          }}
        >
          {transferMode === 'move'
            ? (movingToArtist ? 'Moving...' : 'Move Album to Artist')
            : (mergingAlbum ? 'Merging...' : 'Merge into Album')}
        </button>
      </div>

      {/* Additional Artists Section */}
      <div style={{
        marginTop: '3rem',
        padding: '1.5rem',
        backgroundColor: '#f0fdf4',
        borderRadius: '4px',
        border: '1px solid #86efac'
      }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#166534' }}>
          Additional Artists
        </h3>

        {secondaryArtists.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            {secondaryArtists.map(a => (
              <div key={a.artist_id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: '1px solid #bbf7d0'
              }}>
                <span style={{ fontWeight: '500' }}>{a.name}</span>
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
                    onClick={() => handleRemoveArtistFromAlbum(a.artist_id)}
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

        {!showAddArtistSection ? (
          <button
            type="button"
            onClick={() => setShowAddArtistSection(true)}
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
            + Add Artist
          </button>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
              <select
                value={addArtistRole}
                onChange={(e) => setAddArtistRole(e.target.value)}
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
                onClick={() => { setShowAddArtistSection(false); setAddArtistResults([]); setAddArtistQuery(''); }}
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
            <form onSubmit={handleAddArtistSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <input
                type="text"
                value={addArtistQuery}
                onChange={(e) => setAddArtistQuery(e.target.value)}
                placeholder="Search artist name..."
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
                disabled={addArtistSearching || addArtistQuery.length < 2}
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
                {addArtistSearching ? 'Searching...' : 'Search'}
              </button>
            </form>
            {addArtistResults.length > 0 && (
              <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #86efac', borderRadius: '4px', backgroundColor: 'white' }}>
                {addArtistResults.map(artist => (
                  <div
                    key={artist.id}
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderBottom: '1px solid #e5e7eb',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: '500' }}>{artist.name}</span>
                    <button
                      type="button"
                      onClick={() => handleAddArtistToAlbum(artist)}
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
                      Add as {addArtistRole}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk Update Section - REMOVED, replaced with Move Album section above */}
      {tracks && tracks.length > 0 && false && (
        <div style={{ marginTop: '3rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Update All Tracks (Deprecated)
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
