// src/components/CardGrid.jsx
import { forwardRef } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useViewModeStore } from '../stores/viewModeStore';

// Replaces the repeated <div className="artist-grid-container">...</div>
// markup across browse pages. Adds the `view-list` class (CSS switches grid
// -> flex column) only on desktop in list mode — mobile always keeps the
// plain grid class, since its own layout is driven entirely by the
// @media (max-width: 768px) override in index.css, not by this class.
const CardGrid = forwardRef(({ children }, ref) => {
  const isMobile = useIsMobile();
  const mode = useViewModeStore((s) => s.mode);
  const isList = !isMobile && mode === 'list';

  return (
    <div className={`artist-grid-container${isList ? ' view-list' : ''}`} ref={ref}>
      {children}
    </div>
  );
});

CardGrid.displayName = 'CardGrid';

export default CardGrid;
