// src/components/player/SavePlaylistModal.jsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { apiService } from '../../services/api';

const SavePlaylistModal = ({ trackIds, onClose }) => {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Please enter a playlist name');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.createPlaylist(trimmed, trackIds);
      toast.success(`Saved as "${trimmed}"`);
      onClose();
    } catch (error) {
      console.error('Error saving playlist:', error);
      toast.error('Failed to save playlist');
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      data-testid="save-playlist-modal-backdrop"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1250, padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: 'white', borderRadius: '8px', padding: '1.5rem',
          maxWidth: '400px', width: '100%', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
        }}
      >
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#1f2937' }}>
          Save Queue as Playlist
        </h2>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#374151', fontWeight: '500' }}>
            Playlist Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter playlist name"
            autoFocus
            disabled={submitting}
            style={{
              width: '100%', padding: '0.5rem', border: '1px solid #d1d5db',
              borderRadius: '4px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box',
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '0.625rem 1rem', backgroundColor: '#e5e7eb', color: '#374151',
              border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem',
              fontWeight: '500', minHeight: '44px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            style={{
              flex: 1, padding: '0.625rem 1rem', backgroundColor: submitting ? '#93c5fd' : '#3b82f6',
              color: 'white', border: 'none', borderRadius: '4px',
              cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '0.875rem',
              fontWeight: '500', minHeight: '44px',
            }}
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SavePlaylistModal;
