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

const secondaryStyle = {
  padding: '0.5rem 1rem',
  backgroundColor: 'white',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.875rem',
};

const PlayActionsMenu = ({ onPlayNow, onPlayNext, onAddToQueue }) => {
  const [showMenu, setShowMenu] = useState(false);
  const toggleRef = useRef(null);

  const handlePlayNext = () => {
    onPlayNext();
    setShowMenu(false);
  };

  const handleAddToQueue = () => {
    onAddToQueue();
    setShowMenu(false);
  };

  const menuPosition = () => {
    if (!toggleRef.current) return { top: 0, left: 0 };
    const rect = toggleRef.current.getBoundingClientRect();

    // Estimate menu dimensions for clamping
    const menuWidth = 200;  // matches mobile min-width: 200px !important from CSS
    const menuHeight = 110; // ~2 buttons @ 48px each + padding

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

  return (
    <>
      <div className="play-actions-desktop" style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={onPlayNow} style={playNowStyle}>▶ Play Now</button>
        <button onClick={onPlayNext} style={secondaryStyle}>Play Next</button>
        <button onClick={onAddToQueue} style={secondaryStyle}>Add to Queue</button>
      </div>

      <div className="play-actions-mobile" style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={onPlayNow} style={playNowStyle}>▶ Play Now</button>
        <button
          ref={toggleRef}
          className="play-menu-toggle"
          onClick={() => setShowMenu(true)}
          aria-label="More play options"
        >
          ▾
        </button>
      </div>

      {showMenu && createPortal(
        <>
          <div
            data-testid="play-menu-backdrop"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
            onClick={() => setShowMenu(false)}
          />
          <div className="track-dropdown" style={menuPosition()}>
            <button onClick={handlePlayNext}>⏭ Play Next</button>
            <button onClick={handleAddToQueue}>➕ Add to Queue</button>
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default PlayActionsMenu;
