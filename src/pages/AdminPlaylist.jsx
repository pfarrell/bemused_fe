// src/pages/AdminPlaylist.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

export default function AdminPlaylist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [playlistData, setPlaylistData] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Image download state
  const [imageUrl, setImageUrl] = useState('');
  const [imageName, setImageName] = useState('');
  const [downloadingImage, setDownloadingImage] = useState(false);

  useEffect(() => {
    loadPlaylist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadPlaylist = async () => {
    try {
      setLoading(true);
      const response = await apiService.getPlaylist(id);
      setPlaylistData(response.data.playlist);
      setTracks(response.data.tracks || []);
    } catch (err) {
      console.error('Failed to load playlist:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const response = await apiService.search(searchQuery);
      setSearchResults(response.data.tracks || []);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleAddTrack = async (track) => {
    try {
      await apiService.addTrackToPlaylist(id, track.id);
      setTracks([...tracks, track]);
      setShowSearch(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      console.error('Failed to add track:', err);
      alert('Failed to add track');
    }
  };

  const handleDeleteTrack = async (trackId) => {
    if (!confirm('Are you sure you want to remove this track from the playlist?')) return;

    try {
      await apiService.removeTrackFromPlaylist(id, trackId);
      setTracks(tracks.filter(t => t.id !== trackId));
    } catch (err) {
      console.error('Failed to delete track:', err);
      alert('Failed to delete track');
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newTracks = [...tracks];
    const [movedTrack] = newTracks.splice(draggedIndex, 1);
    newTracks.splice(dropIndex, 0, movedTrack);

    setTracks(newTracks);
    setDraggedIndex(null);

    // Update order on backend
    try {
      const track_orders = newTracks.map((track, index) => ({
        track_id: track.id,
        order: index + 1
      }));
      await apiService.reorderPlaylistTracks(id, track_orders);
    } catch (err) {
      console.error('Failed to reorder tracks:', err);
      alert('Failed to save track order');
      // Reload to get correct order
      loadPlaylist();
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiService.updatePlaylist(id, {
        name: playlistData.name,
        image_path: playlistData.image_path
      });
      navigate(`/playlist/${id}`);
    } catch (err) {
      console.error('Failed to save playlist:', err);
      alert('Failed to save playlist');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadImage = async (e) => {
    e.preventDefault();
    if (!imageUrl || !imageName) {
      alert('Both Image URL and Image Name are required');
      return;
    }

    setDownloadingImage(true);

    try {
      await apiService.downloadPlaylistImage(id, imageUrl, imageName);

      // Update the image path in the form with the newly downloaded image
      setPlaylistData(prev => ({ ...prev, image_path: imageName }));
      setImageUrl('');
      setImageName('');

      // Refresh playlist data to get updated image_path from server
      await loadPlaylist();
    } catch (error) {
      console.error('Error downloading image:', error);
      alert(error.response?.data?.error || 'Failed to download image');
    } finally {
      setDownloadingImage(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div style={{ padding: '2rem', backgroundColor: '#f3f4f6', minHeight: '100%' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>
          Edit Playlist
        </h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => navigate(`/playlist/${id}`)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Playlist Metadata */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '0.5rem',
        marginBottom: '2rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Playlist Name
          </label>
          <input
            type="text"
            value={playlistData?.name || ''}
            onChange={(e) => setPlaylistData({ ...playlistData, name: e.target.value })}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>

        {/* Current Image */}
        {playlistData?.image_path && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Current Image
            </label>
            <img
              src={apiService.getImageUrl(playlistData.image_path, 'album_small')}
              alt="Playlist cover"
              style={{
                maxWidth: '200px',
                borderRadius: '4px',
                border: '1px solid #d1d5db'
              }}
            />
          </div>
        )}

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
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
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
                border: '1px solid #d1d5db',
                borderRadius: '4px',
              }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Save as Filename
            </label>
            <input
              type="text"
              value={imageName}
              onChange={(e) => setImageName(e.target.value)}
              placeholder="playlist_cover.jpg"
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '1rem',
                border: '1px solid #d1d5db',
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
      </div>

      {/* Add Track Button */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => setShowSearch(!showSearch)}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {showSearch ? 'Close Search' : '+ Add Track'}
        </button>
      </div>

      {/* Track Search Modal */}
      {showSearch && (
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '0.5rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search for tracks..."
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
            <button
              onClick={handleSearch}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Search
            </button>
          </div>

          {searchResults.length > 0 && (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {searchResults.map((track) => (
                <div
                  key={track.id}
                  onClick={() => handleAddTrack(track)}
                  style={{
                    padding: '0.75rem',
                    borderBottom: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <div>
                    <div style={{ fontWeight: '500' }}>{track.title}</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {track.artist?.name} • {track.album?.title}
                    </div>
                  </div>
                  <button
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#10b981',
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

      {/* Tracks List */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', fontWeight: '600' }}>
          Tracks ({tracks.length})
        </div>

        {tracks.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
            No tracks in this playlist. Use the search above to add tracks.
          </div>
        ) : (
          tracks.map((track, index) => (
            <div
              key={track.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              style={{
                padding: '1rem',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'move',
                backgroundColor: draggedIndex === index ? '#f3f4f6' : 'white'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                <span style={{ color: '#6b7280', fontSize: '0.875rem', width: '2rem' }}>
                  {index + 1}
                </span>
                <span style={{ fontSize: '1.5rem', color: '#9ca3af', cursor: 'move' }}>
                  ☰
                </span>
                <div>
                  <div style={{ fontWeight: '500' }}>{track.title}</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {track.artist?.name} • {track.album?.title}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDeleteTrack(track.id)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
