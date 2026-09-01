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
        <button onClick={onClose} aria-label="Close" className="iframe-modal-close">×</button>
        <iframe src={url} title="MusicBrainz" style={{ flex: 1, border: 'none', width: '100%' }} />
      </div>
    </div>,
    document.body
  );
};

export default MusicBrainzModal;
