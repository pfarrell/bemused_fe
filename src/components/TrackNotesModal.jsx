// src/components/TrackNotesModal.jsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';

const TrackNotesModal = ({ track, onClose }) => {
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);

  const isConnected = Boolean(user?.recall_connected);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const res = await apiService.getTrackNotes(track.id);
      setNotes(res.data.notes || []);
    } catch (err) {
      console.error('Failed to load track notes', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setPosting(true);
    setError(null);
    try {
      await apiService.addTrackNote(track.id, trimmed);
      setContent('');
      await loadNotes();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to post note');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (noteId) => {
    try {
      await apiService.deleteTrackNote(track.id, noteId);
      await loadNotes();
    } catch (err) {
      console.error('Failed to delete note', err);
    }
  };

  return createPortal(
    <div
      data-testid="track-notes-modal-backdrop"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: 'white', borderRadius: '8px', padding: '1.5rem',
          maxWidth: '500px', width: '100%', maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1f2937' }}>Notes</h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{track.title}</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
          {loading ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>Loading…</div>
          ) : notes.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af' }}>No notes yet</div>
          ) : (
            notes.map((note) => (
              <div key={note.id} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.35rem' }}>
                  {note.author?.username || 'Unknown'} · {new Date(note.created_at).toLocaleDateString()}
                  {!note.error && (
                    <>
                      {' · '}
                      <a href={apiService.getRecallItemUrl(note.recall_item_id)} target="_blank" rel="noopener noreferrer">open in Recall</a>
                    </>
                  )}
                  {isAuthenticated && (user?.id === note.author?.id || user?.admin) && (
                    <>
                      {' · '}
                      <button
                        onClick={() => handleDelete(note.id)}
                        style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}
                      >
                        remove
                      </button>
                    </>
                  )}
                </div>
                {note.error ? (
                  <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>Note unavailable</div>
                ) : (
                  <div style={{ lineHeight: '1.6', color: '#374151' }}>
                    <ReactMarkdown>{note.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {isAuthenticated && (
          isConnected ? (
            <div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write a note (Markdown supported)…"
                rows={4}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  border: '1px solid #d1d5db', borderRadius: '4px',
                  padding: '0.5rem', fontSize: '0.9rem', fontFamily: 'inherit',
                }}
              />
              {error && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>{error}</div>}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '0.5rem 1rem', backgroundColor: '#e5e7eb', color: '#374151',
                    border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500',
                  }}
                >
                  Close
                </button>
                <button
                  onClick={handlePost}
                  disabled={posting || !content.trim()}
                  style={{
                    flex: 1, padding: '0.5rem 1rem', backgroundColor: '#7c3aed', color: 'white',
                    border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500',
                  }}
                >
                  {posting ? 'Posting…' : 'Post'}
                </button>
              </div>
            </div>
          ) : (
            <a
              href={`${apiService.getRecallConnectUrl()}?return_to=${encodeURIComponent(location.pathname)}`}
              style={{
                display: 'inline-block', padding: '0.5rem 1rem', backgroundColor: '#6b7280',
                color: 'white', borderRadius: '4px', textDecoration: 'none', fontSize: '0.875rem',
              }}
            >
              Connect Recall to write notes
            </a>
          )
        )}
      </div>
    </div>,
    document.body
  );
};

export default TrackNotesModal;
