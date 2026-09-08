// src/components/ViewModeToggle.jsx
import { useViewModeStore } from '../stores/viewModeStore';

// Small pill with two icon buttons (grid glyph / list glyph), styled like
// HomeViewToggle's dark-surface pill. No text labels, so accessibility relies
// on aria-label / aria-pressed rather than visible text. Desktop-only
// visibility is handled by the wrapping `.view-mode-toggle-desktop` div in
// Layout.jsx, not by this component — it always renders unconditionally,
// same as HomeViewToggle does.
const ViewModeToggle = () => {
  const { mode, setMode } = useViewModeStore();

  const buttonStyle = (active) => ({
    background: active ? '#3b82f6' : 'none',
    color: active ? 'white' : 'var(--color-text-faint)',
    width: '28px',
    height: '28px',
    borderRadius: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    cursor: 'pointer',
  });

  return (
    <div style={{ display: 'inline-flex', background: '#1a252f', borderRadius: '20px', padding: '3px', gap: '2px' }}>
      <button
        type="button"
        aria-label="Card view"
        aria-pressed={mode === 'card'}
        onClick={() => setMode('card')}
        style={buttonStyle(mode === 'card')}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <rect x="2" y="2" width="7" height="7" rx="1" />
          <rect x="11" y="2" width="7" height="7" rx="1" />
          <rect x="2" y="11" width="7" height="7" rx="1" />
          <rect x="11" y="11" width="7" height="7" rx="1" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="List view"
        aria-pressed={mode === 'list'}
        onClick={() => setMode('list')}
        style={buttonStyle(mode === 'list')}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <rect x="2" y="3" width="16" height="3" rx="1" />
          <rect x="2" y="8.5" width="16" height="3" rx="1" />
          <rect x="2" y="14" width="16" height="3" rx="1" />
        </svg>
      </button>
    </div>
  );
};

export default ViewModeToggle;
