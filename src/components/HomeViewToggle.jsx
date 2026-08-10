// src/components/HomeViewToggle.jsx
import { useHomeModeStore } from '../stores/homeModeStore';

// Segmented Artists/Albums control for the home feed. Callers own their own
// label/wrapper styling (Layout.jsx's dropdown-item padding vs Account.jsx's
// card) — this component renders only the toggle itself.
const HomeViewToggle = ({ onSelect }) => {
  const { mode, setMode } = useHomeModeStore();

  const select = (newMode) => {
    setMode(newMode);
    onSelect?.();
  };

  return (
    <div style={{ display: 'inline-flex', background: '#1a252f', borderRadius: '20px', padding: '3px' }}>
      <button
        onClick={() => select('artists')}
        style={{
          background: mode === 'artists' ? '#3b82f6' : 'none',
          color: mode === 'artists' ? 'white' : '#9ca3af',
          padding: '4px 14px', borderRadius: '18px',
          fontSize: '0.75rem', fontWeight: '600',
          border: 'none', cursor: 'pointer',
        }}
      >
        Artists
      </button>
      <button
        onClick={() => select('albums')}
        style={{
          background: mode === 'albums' ? '#3b82f6' : 'none',
          color: mode === 'albums' ? 'white' : '#9ca3af',
          padding: '4px 14px', borderRadius: '18px',
          fontSize: '0.75rem', fontWeight: '600',
          border: 'none', cursor: 'pointer',
        }}
      >
        Albums
      </button>
    </div>
  );
};

export default HomeViewToggle;
