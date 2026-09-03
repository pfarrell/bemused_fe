import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

const playNowStyle = {
  padding: '0.5rem 1rem',
  backgroundColor: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: '500',
};

const getMenuPosition = (toggleRef, menuWidth, menuHeight) => {
  if (!toggleRef.current) return { top: 0, left: 0 };
  const rect = toggleRef.current.getBoundingClientRect();

  let left = rect.left;
  let top = rect.bottom + 4;

  // Keep menu on screen horizontally
  if (left + menuWidth > window.innerWidth) {
    left = window.innerWidth - menuWidth - 10;
  }
  if (left < 10) {
    left = 10;
  }

  // Keep menu on screen vertically
  if (top + menuHeight > window.innerHeight) {
    top = Math.max(10, rect.top - menuHeight - 4);
  }
  if (top < 10) {
    top = 10;
  }

  return { top, left };
};

// Single compact action bar used on every screen size: a Play Now button,
// a "▾" dropdown for the secondary play actions (Play Next / Add to Queue),
// and an optional "⋯" dropdown for whatever page-specific actions the
// caller passes in (Edit, Share, Add to Collection, Add to Favorites, ...).
// Replaces the old desktop-only row of flat buttons — every play action
// beyond "Play Now" now lives behind one of the two dropdowns, on desktop
// and mobile alike, so the header stays a small, consistent set of controls
// no matter how many actions a given page needs.
const PlayActionsMenu = ({ onPlayNow, onPlayNext, onAddToQueue, overflowActions = [], disabled = false }) => {
  const [showPlayMenu, setShowPlayMenu] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const playToggleRef = useRef(null);
  const overflowToggleRef = useRef(null);

  const hasPlayMenu = !!(onPlayNext || onAddToQueue);
  const hasOverflowMenu = overflowActions.length > 0;

  const handlePlayNext = () => {
    onPlayNext();
    setShowPlayMenu(false);
  };

  const handleAddToQueue = () => {
    onAddToQueue();
    setShowPlayMenu(false);
  };

  const handleOverflowAction = (action) => {
    action.onClick();
    setShowOverflowMenu(false);
  };

  return (
    <div className="play-actions-bar" style={{ display: 'flex', gap: '0.5rem' }}>
      {onPlayNow && (
        <button
          onClick={onPlayNow}
          disabled={disabled}
          style={{ ...playNowStyle, ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
        >
          ▶ Play Now
        </button>
      )}

      {hasPlayMenu && (
        <button
          ref={playToggleRef}
          className="play-menu-toggle"
          onClick={() => setShowPlayMenu(true)}
          disabled={disabled}
          aria-label="More play options"
          style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          ▾
        </button>
      )}

      {hasOverflowMenu && (
        <button
          ref={overflowToggleRef}
          className="play-menu-toggle"
          onClick={() => setShowOverflowMenu(true)}
          aria-label="More actions"
        >
          ⋯
        </button>
      )}

      {showPlayMenu && createPortal(
        <>
          <div
            data-testid="play-menu-backdrop"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
            onClick={() => setShowPlayMenu(false)}
          />
          <div className="track-dropdown" style={getMenuPosition(playToggleRef, 200, 110)}>
            {onPlayNext && <button onClick={handlePlayNext}>⏭ Play Next</button>}
            {onAddToQueue && <button onClick={handleAddToQueue}>➕ Add to Queue</button>}
          </div>
        </>,
        document.body
      )}

      {showOverflowMenu && createPortal(
        <>
          <div
            data-testid="overflow-menu-backdrop"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
            onClick={() => setShowOverflowMenu(false)}
          />
          <div
            className="track-dropdown"
            style={getMenuPosition(overflowToggleRef, 200, overflowActions.length * 40 + 8)}
          >
            {overflowActions.map((action) => (
              <button key={action.key} onClick={() => handleOverflowAction(action)}>
                {action.icon} {action.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default PlayActionsMenu;
