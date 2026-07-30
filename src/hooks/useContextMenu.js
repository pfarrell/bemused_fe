import { useEffect, useRef, useState } from 'react';
import { useIsMobile } from './useIsMobile';

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;
const MENU_WIDTH_ESTIMATE = 200; // matches the mobile breakpoint's .track-dropdown CSS min-width; used only to center the long-press open position, not to clamp (see ContextMenu.jsx's own MENU_WIDTH for the on-screen clamp)

// Shared right-click (desktop) / long-press (mobile) gesture detection for
// per-item action menus (Track.jsx and AlbumCard.jsx each had their own
// near-identical copy of this before it was extracted here). Owns open
// state, raw open position, and the trickiest part to get right: swallowing
// the synthesized click/touchend that follows a long-press finger-release so
// the menu doesn't immediately close itself. Render the actual menu with the
// <ContextMenu> component using the values this hook returns.
export const useContextMenu = ({ shouldIgnore } = {}) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef(null);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const justOpenedByLongPress = useRef(false);
  const clearLongPressFlagTimer = useRef(null);

  useEffect(() => () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (clearLongPressFlagTimer.current) clearTimeout(clearLongPressFlagTimer.current);
  }, []);

  const openAt = (x, y) => {
    setPosition({ x, y });
    setOpen(true);
  };

  const close = () => setOpen(false);

  const onContextMenu = (e) => {
    if (shouldIgnore?.(e)) return;
    e.preventDefault();
    e.stopPropagation();
    openAt(e.clientX, e.clientY);
  };

  const onTouchStart = (e) => {
    if (open || shouldIgnore?.(e)) return;
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    longPressTimer.current = setTimeout(() => {
      justOpenedByLongPress.current = true;
      const x = isMobile ? Math.max(10, touchStartPos.current.x - MENU_WIDTH_ESTIMATE / 2) : touchStartPos.current.x;
      openAt(x, touchStartPos.current.y);
      if (navigator.vibrate) navigator.vibrate(50);
    }, LONG_PRESS_MS);
  };

  const onTouchMove = (e) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    }
  };

  const onTouchEnd = (e) => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (justOpenedByLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      if (clearLongPressFlagTimer.current) clearTimeout(clearLongPressFlagTimer.current);
      clearLongPressFlagTimer.current = setTimeout(() => { justOpenedByLongPress.current = false; }, 350);
      return;
    }
    if (open) { e.preventDefault(); e.stopPropagation(); }
  };

  const dismiss = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (justOpenedByLongPress.current) return;
    close();
  };

  const swallowTouch = (e) => { e.preventDefault(); e.stopPropagation(); };

  return {
    open,
    position,
    triggerProps: { onContextMenu, onTouchStart, onTouchMove, onTouchEnd },
    close,
    dismiss,
    swallowTouch,
  };
};
