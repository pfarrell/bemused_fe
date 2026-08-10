// src/components/HomeViewToggle.jsx
import { useHomeModeStore } from '../stores/homeModeStore';

// Segmented Artists/Albums control for the home feed. Callers own their own
// label/wrapper styling (Layout.jsx's dropdown-item padding vs Account.jsx's
// card) — this component renders only the toggle itself.
//
// `variant` picks the surface colors: 'dark' (default) matches the hamburger
// dropdown's dark background (#2a3540); 'light' matches Account.jsx's white
// cards. The active-tab styling (#3b82f6 background / white text) is shared —
// it reads fine on both surfaces.
const HomeViewToggle = ({ onSelect, variant = 'dark' }) => {
  const { mode, setMode } = useHomeModeStore();
  const pillBackground = variant === 'light' ? '#f3f4f6' : '#1a252f';
  const inactiveColor = variant === 'light' ? '#6b7280' : '#9ca3af';

  const select = (newMode) => {
    setMode(newMode);
    onSelect?.();
  };

  return (
    <div style={{ display: 'inline-flex', background: pillBackground, borderRadius: '20px', padding: '3px' }}>
      <button
        onClick={() => select('artists')}
        style={{
          background: mode === 'artists' ? '#3b82f6' : 'none',
          color: mode === 'artists' ? 'white' : inactiveColor,
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
          color: mode === 'albums' ? 'white' : inactiveColor,
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
