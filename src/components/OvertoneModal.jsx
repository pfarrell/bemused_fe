// src/components/OvertoneModal.jsx
import { createPortal } from 'react-dom';

const OvertoneModal = ({ url, onClose }) => {
  return createPortal(
    <div
      data-testid="overtone-modal-backdrop"
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
          backgroundColor: 'white', borderRadius: '8px',
          width: '100%', maxWidth: '900px', height: '90vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb', flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1f2937' }}>Overtone</span>
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
        <iframe src={url} title="Overtone" style={{ flex: 1, border: 'none', width: '100%' }} />
      </div>
    </div>,
    document.body
  );
};

export default OvertoneModal;
