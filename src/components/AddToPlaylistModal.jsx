// src/components/AddToPlaylistModal.jsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { apiService } from '../services/api';

const AddToPlaylistModal = ({ track, onClose }) => {
  const [playlists, setPlaylists] = useState([]);
  const [filteredPlaylists, setFilteredPlaylists] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(null); // { type: 'duplicate-name' | 'duplicate-track', playlistId, playlistName }

  // Load playlists on mount
  useEffect(() => {
    loadPlaylists();
  }, []);

  // Filter playlists when filterText changes
  useEffect(() => {
    if (filterText.trim() === '') {
      setFilteredPlaylists(playlists);
    } else {
      const filtered = playlists.filter(playlist =>
        playlist.name && playlist.name.toLowerCase().includes(filterText.toLowerCase())
      );
      setFilteredPlaylists(filtered);
    }
  }, [filterText, playlists]);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const response = await apiService.getPlaylists();
      const playlistData = response.data || [];

      // Sort by updated_at descending (most recent first)
      const sortedPlaylists = playlistData.sort((a, b) => {
        const aDate = a.updated_at ? new Date(a.updated_at) : new Date(0);
        const bDate = b.updated_at ? new Date(b.updated_at) : new Date(0);
        return bDate - aDate;
      });

      setPlaylists(sortedPlaylists);
      setFilteredPlaylists(sortedPlaylists);
    } catch (error) {
      console.error('Error loading playlists:', error);
      toast.error('Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlaylist = (playlist) => {
    setSelectedPlaylist(playlist);
  };

  const handleCreateNewClick = () => {
    setIsCreatingNew(true);
    setNewPlaylistName('');
  };

  const handleBackToList = () => {
    setIsCreatingNew(false);
    setNewPlaylistName('');
    setSelectedPlaylist(null);
  };

  const checkDuplicateTrack = async (playlistId) => {
    try {
      const response = await apiService.getPlaylist(playlistId);
      const playlistData = response.data;
      const tracks = playlistData.tracks || [];
      return tracks.some(t => t.id === track.id);
    } catch (error) {
      console.error('Error checking for duplicate track:', error);
      return false;
    }
  };

  const addTrackToPlaylist = async (playlistId, playlistName) => {
    try {
      // Check for duplicate track
      const isDuplicate = await checkDuplicateTrack(playlistId);

      if (isDuplicate) {
        setShowConfirmation({
          type: 'duplicate-track',
          playlistId,
          playlistName,
          message: `"${track.title}" is already in "${playlistName}". Add it anyway?`
        });
        return;
      }

      // Add the track
      await apiService.addTrackToPlaylist(playlistId, track.id);
      toast.success(`Added "${track.title}" to "${playlistName}"`);
      onClose();
    } catch (error) {
      console.error('Error adding track to playlist:', error);
      toast.error('Failed to add track to playlist');
    }
  };

  const confirmAddDuplicate = async () => {
    const { playlistId, playlistName } = showConfirmation;
    try {
      await apiService.addTrackToPlaylist(playlistId, track.id);
      toast.success(`Added "${track.title}" to "${playlistName}"`);
      setShowConfirmation(null);
      onClose();
    } catch (error) {
      console.error('Error adding track to playlist:', error);
      toast.error('Failed to add track to playlist');
      setShowConfirmation(null);
    }
  };

  const handleAddToPlaylist = async () => {
    if (isCreatingNew) {
      // Creating new playlist
      const trimmedName = newPlaylistName.trim();

      if (!trimmedName) {
        toast.error('Please enter a playlist name');
        return;
      }

      // Check if playlist name already exists (case-insensitive)
      const existingPlaylist = playlists.find(
        p => p.name && p.name.toLowerCase() === trimmedName.toLowerCase()
      );

      if (existingPlaylist) {
        setShowConfirmation({
          type: 'duplicate-name',
          playlistId: existingPlaylist.id,
          playlistName: existingPlaylist.name,
          message: `A playlist named "${existingPlaylist.name}" already exists. Add track to existing playlist?`
        });
        return;
      }

      // Create new playlist and add track
      try {
        const createResponse = await apiService.createPlaylist(trimmedName);
        const newPlaylist = createResponse.data;
        await apiService.addTrackToPlaylist(newPlaylist.id, track.id);
        toast.success(`Created "${trimmedName}" and added "${track.title}"`);
        onClose();
      } catch (error) {
        console.error('Error creating playlist:', error);
        toast.error('Failed to create playlist');
      }
    } else {
      // Adding to selected playlist
      if (!selectedPlaylist) {
        toast.error('Please select a playlist');
        return;
      }
      await addTrackToPlaylist(selectedPlaylist.id, selectedPlaylist.name);
    }
  };

  const confirmAddToExisting = async () => {
    const { playlistId, playlistName } = showConfirmation;
    await addTrackToPlaylist(playlistId, playlistName);
    setShowConfirmation(null);
  };

  // Render confirmation dialog
  if (showConfirmation) {
    return createPortal(
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
          padding: '1rem'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowConfirmation(null);
          }
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '1.5rem',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}
        >
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', color: '#1f2937' }}>
            Confirm
          </h3>
          <p style={{ margin: '0 0 1.5rem 0', color: '#4b5563', lineHeight: '1.5' }}>
            {showConfirmation.message}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowConfirmation(null)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Cancel
            </button>
            <button
              onClick={showConfirmation.type === 'duplicate-name' ? confirmAddToExisting : confirmAddDuplicate}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              {showConfirmation.type === 'duplicate-name' ? 'Add to Existing' : 'Add Anyway'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Main modal
  return createPortal(
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
        padding: '1rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1f2937' }}>
            {isCreatingNew ? 'Create New Playlist' : 'Add to Playlist'}
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            {track.title}
          </p>
        </div>

        {isCreatingNew ? (
          // Create new playlist mode
          <>
            <div style={{ flex: 1, marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#374151', fontWeight: '500' }}>
                Playlist Name
              </label>
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Enter playlist name"
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddToPlaylist();
                  }
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleBackToList}
                style={{
                  padding: '0.625rem 1rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  minHeight: '44px'
                }}
              >
                Back
              </button>
              <button
                onClick={handleAddToPlaylist}
                style={{
                  flex: 1,
                  padding: '0.625rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  minHeight: '44px'
                }}
              >
                Create & Add Track
              </button>
            </div>
          </>
        ) : (
          // Select playlist mode
          <>
            {/* Filter input */}
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter playlists..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Playlist list */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                marginBottom: '1rem',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                minHeight: '200px',
                maxHeight: '400px'
              }}
            >
              {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  Loading playlists...
                </div>
              ) : (
                <>
                  {/* Create New option */}
                  <div
                    onClick={handleCreateNewClick}
                    style={{
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #e5e7eb',
                      backgroundColor: '#f9fafb',
                      fontWeight: '500',
                      color: '#3b82f6',
                      minHeight: '44px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    + Create New...
                  </div>

                  {/* Existing playlists */}
                  {filteredPlaylists.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      No playlists found
                    </div>
                  ) : (
                    filteredPlaylists.map((playlist) => (
                      <div
                        key={playlist.id}
                        onClick={() => handleSelectPlaylist(playlist)}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #e5e7eb',
                          backgroundColor: selectedPlaylist?.id === playlist.id ? '#dbeafe' : 'transparent',
                          transition: 'background-color 0.15s ease',
                          minHeight: '44px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedPlaylist?.id !== playlist.id) {
                            e.currentTarget.style.backgroundColor = '#f9fafb';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedPlaylist?.id !== playlist.id) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        {playlist.name || '(Unnamed Playlist)'}
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '0.625rem 1rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  minHeight: '44px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddToPlaylist}
                disabled={!selectedPlaylist}
                style={{
                  flex: 1,
                  padding: '0.625rem 1rem',
                  backgroundColor: selectedPlaylist ? '#3b82f6' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: selectedPlaylist ? 'pointer' : 'not-allowed',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  minHeight: '44px',
                  opacity: selectedPlaylist ? 1 : 0.6
                }}
              >
                Add to Playlist
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default AddToPlaylistModal;
