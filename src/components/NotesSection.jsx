// src/components/NotesSection.jsx
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';

const NotesSection = ({ albumId, notes, isLoggedIn, onChange }) => {
  const location = useLocation();
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);

  const isConnected = Boolean(user?.recall_connected);

  const handlePost = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setPosting(true);
    setError(null);
    try {
      await apiService.addAlbumNote(albumId, trimmed);
      setContent('');
      onChange();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to post note');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (noteId) => {
    try {
      await apiService.deleteAlbumNote(albumId, noteId);
      onChange();
    } catch (err) {
      console.error('Failed to delete note', err);
    }
  };

  if (!isLoggedIn && notes.length === 0) return null;

  return (
    <div style={{
      marginTop: '1.5rem',
      padding: '1rem',
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      border: '1px solid #e5e7eb'
    }}>
      <div style={{
        fontSize: '0.75rem',
        fontWeight: '600',
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.75rem'
      }}>
        Notes
      </div>

      {notes.map((note) => (
        <div key={note.id} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.35rem' }}>
            {note.author?.username || 'Unknown'} · {new Date(note.created_at).toLocaleDateString()}
            {!note.error && (
              <>
                {' · '}
                <a href={apiService.getRecallItemUrl(note.recall_item_id)} target="_blank" rel="noopener noreferrer">
                  open in Recall
                </a>
              </>
            )}
            {isLoggedIn && !note.error && (user?.id === note.author?.id || user?.admin) && (
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
      ))}

      {isLoggedIn && (
        isConnected ? (
          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write a note (Markdown supported)…"
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                padding: '0.5rem',
                fontSize: '0.9rem',
                fontFamily: 'inherit',
              }}
            />
            {error && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>{error}</div>}
            <button
              onClick={handlePost}
              disabled={posting || !content.trim()}
              style={{
                marginTop: '0.5rem',
                padding: '0.4rem 0.9rem',
                backgroundColor: '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        ) : (
          <a
            href={`${apiService.getRecallConnectUrl()}?return_to=${encodeURIComponent(location.pathname)}`}
            style={{
              display: 'inline-block',
              padding: '0.4rem 0.9rem',
              backgroundColor: '#6b7280',
              color: 'white',
              borderRadius: '4px',
              textDecoration: 'none',
              fontSize: '0.85rem',
            }}
          >
            Connect Recall to write notes
          </a>
        )
      )}
    </div>
  );
};

export default NotesSection;
