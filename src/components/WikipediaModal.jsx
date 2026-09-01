// src/components/WikipediaModal.jsx
import { createPortal } from 'react-dom';

// View-only: unlike OvertoneModal, there's no postMessage bridge here —
// Wikipedia never navigates the parent app, so the iframe just displays.
const WikipediaModal = ({ url, onClose }) => {
  return createPortal(
    <div
      data-testid="wikipedia-modal-backdrop"
      className="iframe-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="iframe-modal-box">
        <button onClick={onClose} aria-label="Close" className="iframe-modal-close">×</button>
        <iframe src={url} title="Wikipedia" style={{ flex: 1, border: 'none', width: '100%' }} />
      </div>
    </div>,
    document.body
  );
};

export default WikipediaModal;
