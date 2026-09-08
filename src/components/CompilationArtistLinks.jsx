import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isMobileDevice } from '../utils/device';

const DEFAULT_VISIBLE_COUNT = 15;

const CompilationArtistLinks = ({ artists = [], visibleCount = DEFAULT_VISIBLE_COUNT, mobileVisibleCount = DEFAULT_VISIBLE_COUNT }) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const limit = isMobileDevice() ? mobileVisibleCount : visibleCount;
  const visible = expanded ? artists : artists.slice(0, limit);
  const hiddenCount = artists.length - limit;

  return (
    <>
      {visible.map((a, i) => (
        <span key={a.id}>
          {i > 0 && ' · '}
          <span style={{ color: '#3b82f6', cursor: 'pointer' }} onClick={() => navigate(`/artist/${a.id}`)}>
            {a.name}
          </span>
        </span>
      ))}
      {!expanded && hiddenCount > 0 && (
        <span
          style={{ cursor: 'pointer', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}
          onClick={() => setExpanded(true)}
        >
          + {hiddenCount} more
        </span>
      )}
    </>
  );
};

export default CompilationArtistLinks;
