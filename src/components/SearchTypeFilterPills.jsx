// src/components/SearchTypeFilterPills.jsx
const TYPE_ORDER = ['album', 'artist', 'playlist', 'collection'];
const TYPE_LABELS = {
  album: 'Albums',
  artist: 'Artists',
  playlist: 'Playlists',
  collection: 'Collections',
};

const SearchTypeFilterPills = ({ results, activeTypes, onToggle }) => {
  const counts = TYPE_ORDER.reduce((acc, type) => {
    acc[type] = results.filter((r) => r.type === type).length;
    return acc;
  }, {});

  const visibleTypes = TYPE_ORDER.filter((type) => counts[type] > 0);
  if (visibleTypes.length === 0) return null;

  return (
    <div className="search-type-pills">
      {visibleTypes.map((type) => (
        <button
          key={type}
          type="button"
          className={`search-type-pill${activeTypes.has(type) ? ' active' : ''}`}
          onClick={() => onToggle(type)}
        >
          {TYPE_LABELS[type]} {counts[type]}
        </button>
      ))}
    </div>
  );
};

export default SearchTypeFilterPills;
