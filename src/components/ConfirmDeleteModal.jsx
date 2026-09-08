// src/components/ConfirmDeleteModal.jsx
import { useState } from 'react';
import { createPortal } from 'react-dom';

const CONFIRM_WORD = 'delete me';

// A type-to-confirm gate for destructive, cascading admin deletes (artist,
// album). A plain window.confirm() is trivially dismissed without reading —
// this forces the admin to type a fixed phrase, giving them a moment to
// notice the message/title if it's the wrong entity.
const ConfirmDeleteModal = ({ title, message, onConfirm, onCancel }) => {
  const [input, setInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const canDelete = input === CONFIRM_WORD;

  const handleConfirm = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete — try again');
      setDeleting(false);
    }
  };

  return createPortal(
    <div
      data-testid="confirm-delete-modal-backdrop"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !deleting) onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-modal-title"
        style={{
          backgroundColor: 'white', borderRadius: '8px', padding: '1.5rem',
          maxWidth: '400px', width: '100%',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
        }}
      >
        <h2 id="confirm-delete-modal-title" style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#1f2937' }}>{title}</h2>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#6b7280' }}>{message}</p>
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#374151' }}>
          Type <strong>delete me</strong> to confirm:
        </p>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
          disabled={deleting}
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box', padding: '0.5rem',
            border: '1px solid #d1d5db', borderRadius: '4px',
            fontSize: '0.9rem', marginBottom: '1rem',
          }}
        />

        {error && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            onClick={handleConfirm}
            disabled={!canDelete || deleting}
            style={{
              padding: '0.6rem', backgroundColor: '#ef4444', color: 'white',
              border: 'none', borderRadius: '4px', fontWeight: 'bold',
              cursor: (!canDelete || deleting) ? 'not-allowed' : 'pointer',
              opacity: (!canDelete || deleting) ? 0.5 : 1,
            }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button
            onClick={onCancel}
            disabled={deleting}
            style={{
              padding: '0.6rem', backgroundColor: 'white', color: '#374151',
              border: '1px solid #d1d5db', borderRadius: '4px',
              cursor: deleting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDeleteModal;
