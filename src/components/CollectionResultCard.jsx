// src/components/CollectionResultCard.jsx
import { formatCount } from '../utils/formatters';

const CollectionResultCard = ({ collection, onClick, imageUrl }) => {
  return (
    <div className="artist-card" onClick={() => onClick(collection)}>
      <div className="artist-card-image">
        <img
          src={imageUrl}
          alt={collection.name}
          onError={(e) => {
            if (e.target.src.includes('/sm/')) {
              e.target.src = e.target.src.replace('/sm/', '/');
              e.target.onerror = null;
            }
          }}
        />
      </div>
      <div className="artist-card-title">
        <h3>{collection.name}</h3>
        {formatCount(collection.album_count || null, 'album') && (
          <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '0.125rem 0 0 0' }}>
            {formatCount(collection.album_count || null, 'album')}
          </p>
        )}
      </div>
    </div>
  );
};

export default CollectionResultCard;
