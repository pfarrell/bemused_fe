import { Children } from 'react';
import { createPortal } from 'react-dom';

const MENU_WIDTH = 240; // clamp estimate used before layout; comfortably covers the mobile breakpoint's 200px min-width plus longer labels (e.g. "★ Remove from Favorites") at its larger 1rem font/padding
const BUTTON_HEIGHT = 44;
const MENU_PADDING = 16;

// Portals and positions the action menu opened by useContextMenu, clamped to
// stay on-screen. Children are the menu's own <button> elements — this
// component only owns the backdrop, portal, and positioning; callers own
// what the menu contains (button labels, styles, per-action behavior).
const ContextMenu = ({ open, position, onDismiss, onSwallowTouch, testId = 'context-menu-backdrop', children }) => {
  if (!open) return null;

  const menuHeight = Children.toArray(children).filter(Boolean).length * BUTTON_HEIGHT + MENU_PADDING;
  let left = position.x;
  let top = position.y;
  if (left + MENU_WIDTH > window.innerWidth) left = window.innerWidth - MENU_WIDTH - 10;
  if (left < 10) left = 10;
  if (top + menuHeight > window.innerHeight) top = Math.max(10, top - menuHeight - 10);
  if (top < 10) top = 10;

  return createPortal(
    <>
      <div
        data-testid={testId}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
        onClick={onDismiss}
        onTouchStart={onSwallowTouch}
        onTouchEnd={onDismiss}
      />
      <div className="track-dropdown" style={{ position: 'fixed', left: `${left}px`, top: `${top}px`, zIndex: 100 }}>
        {children}
      </div>
    </>,
    document.body
  );
};

export default ContextMenu;
