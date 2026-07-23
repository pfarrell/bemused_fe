// src/components/PlaylistResultCard.jsx
import { formatCount } from '../utils/formatters';

const PlaylistResultCard = ({ playlist, onClick, imageUrl }) => {
  return (
    <div className="artist-card" onClick={() => onClick(playlist)}>
      <div className="artist-card-image">
        <img
          src={imageUrl}
          alt={playlist.name}
          onError={(e) => {
            if (e.target.src.includes('/sm/')) {
              e.target.src = e.target.src.replace('/sm/', '/');
              e.target.onerror = null;
            }
          }}
        />
      </div>
      <div className="artist-card-title">
        <h3>{playlist.name}</h3>
        {formatCount(playlist.track_count || null, 'track') && (
          <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '0.125rem 0 0 0' }}>
            {formatCount(playlist.track_count || null, 'track')}
          </p>
        )}
      </div>
    </div>
  );
};

export default PlaylistResultCard;
