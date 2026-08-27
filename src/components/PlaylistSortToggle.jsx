// src/components/PlaylistSortToggle.jsx
import { usePlaylistSortStore } from '../stores/playlistSortStore';

// Light-surface pill with text labels, sized for the white-card Playlists
// page — ViewModeToggle's dark pill is built for the header dropdown and
// doesn't fit here.
const PlaylistSortToggle = () => {
  const { sortBy, setSortBy } = usePlaylistSortStore();

  const buttonStyle = (active) => ({
    background: active ? '#3b82f6' : 'none',
    color: active ? 'white' : '#6b7280',
    padding: '0.375rem 0.75rem',
    borderRadius: '18px',
    fontSize: '0.8125rem',
    fontWeight: '500',
    border: 'none',
    cursor: 'pointer',
  });

  return (
    <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: '20px', padding: '3px', gap: '2px' }}>
      <button
        type="button"
        aria-label="Sort by recently updated"
        aria-pressed={sortBy === 'recent'}
        onClick={() => setSortBy('recent')}
        style={buttonStyle(sortBy === 'recent')}
      >
        Recent
      </button>
      <button
        type="button"
        aria-label="Sort alphabetically"
        aria-pressed={sortBy === 'alpha'}
        onClick={() => setSortBy('alpha')}
        style={buttonStyle(sortBy === 'alpha')}
      >
        A–Z
      </button>
    </div>
  );
};

export default PlaylistSortToggle;
