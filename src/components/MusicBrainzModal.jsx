// src/components/MusicBrainzModal.jsx
import { createPortal } from 'react-dom';

// View-only, like WikipediaModal: musicbrainz.org never navigates the parent
// app, so the iframe just displays.
const MusicBrainzModal = ({ url, onClose }) => {
  return createPortal(
    <div
      data-testid="musicbrainz-modal-backdrop"
      className="iframe-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="iframe-modal-box">
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb', flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280',
              fontSize: '1.5rem', lineHeight: 1, padding: '0.25rem 0.5rem', minHeight: '44px',
            }}
          >
            ×
          </button>
        </div>
        <iframe src={url} title="MusicBrainz" style={{ flex: 1, border: 'none', width: '100%' }} />
      </div>
    </div>,
    document.body
  );
};

export default MusicBrainzModal;
