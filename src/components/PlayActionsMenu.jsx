import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

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

// Single compact action bar used on every screen size: a Play Now control
// plus one dropdown menu holding every secondary action — Play Next / Add
// to Queue first (when provided), then whatever page-specific
// overflowActions the caller passes in (Edit, Share, Add to Collection,
// Add to Favorites, ...). When both a Play Now handler and menu items
// exist, the two render as one fused "split button" (a gradient circle for
// Play Now with a narrow "▾" tab attached to it) so they read as a single
// control while keeping separate click targets — clicking the circle plays,
// clicking the tab opens the menu.
const PlayActionsMenu = ({ onPlayNow, onPlayNext, onAddToQueue, overflowActions = [], disabled = false }) => {
  const [showMenu, setShowMenu] = useState(false);
  const toggleRef = useRef(null);

  const menuItems = [
    onPlayNext && { key: 'play-next', icon: '⏭', label: 'Play Next', onClick: onPlayNext },
    onAddToQueue && { key: 'add-queue', icon: '➕', label: 'Add to Queue', onClick: onAddToQueue },
    ...overflowActions,
  ].filter(Boolean);

  const hasPlayNow = !!onPlayNow;
  const hasMenu = menuItems.length > 0;

  const handleMenuItem = (item) => {
    item.onClick();
    setShowMenu(false);
  };

  const menu = showMenu && createPortal(
    <>
      <div
        data-testid="play-actions-menu-backdrop"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
        onClick={() => setShowMenu(false)}
      />
      <div className="track-dropdown" style={getMenuPosition(toggleRef, 200, menuItems.length * 40 + 8)}>
        {menuItems.map((item) => (
          <button key={item.key} onClick={() => handleMenuItem(item)}>
            {item.icon} {item.label}
          </button>
        ))}
      </div>
    </>,
    document.body
  );

  return (
    <div className="play-actions-bar" style={{ display: 'flex', gap: '0.5rem' }}>
      {hasPlayNow && hasMenu && (
        <div className={`play-split${disabled ? ' play-split-disabled' : ''}`}>
          <button
            onClick={onPlayNow}
            disabled={disabled}
            className="play-split-play"
            aria-label="Play Now"
            title="Play Now"
          >
            <span className="play-now-circle-triangle" aria-hidden="true" />
          </button>
          <button
            ref={toggleRef}
            onClick={() => setShowMenu(true)}
            disabled={disabled}
            className="play-split-toggle"
            aria-label="More options"
          >
            ▾
          </button>
        </div>
      )}

      {hasPlayNow && !hasMenu && (
        <button
          onClick={onPlayNow}
          disabled={disabled}
          className="play-now-circle"
          aria-label="Play Now"
          title="Play Now"
        >
          <span className="play-now-circle-triangle" aria-hidden="true" />
        </button>
      )}

      {!hasPlayNow && hasMenu && (
        <button
          ref={toggleRef}
          className="play-oval-toggle"
          onClick={() => setShowMenu(true)}
          aria-label="More options"
        >
          ▾
        </button>
      )}

      {menu}
    </div>
  );
};

export default PlayActionsMenu;
