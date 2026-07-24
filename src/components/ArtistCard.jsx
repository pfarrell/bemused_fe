// src/components/ArtistCard.jsx
import { formatCount } from '../utils/formatters';
import ResultRow from './ResultRow';
import { useIsMobile } from '../hooks/useIsMobile';

const ArtistCard = ({ artist, onClick, imageUrl }) => {
  const isMobile = useIsMobile();

  const handleImageError = (e) => {
    if (e.target.src.includes('/sm/')) {
      e.target.src = e.target.src.replace('/sm/', '/');
      e.target.onerror = null;
    }
  };

  if (isMobile) {
    return (
      <ResultRow
        imageUrl={imageUrl}
        imageShape="circle"
        title={artist.name}
        subtitle="Artist"
        onClick={() => onClick(artist)}
        onImageError={handleImageError}
      />
    );
  }

  return (
    <div className="artist-card" onClick={() => onClick(artist)}>
      <div className="artist-card-image">
        <img
          src={imageUrl}
          alt={artist.name}
          onError={handleImageError}
        />
      </div>

      <div className="artist-card-title">
        <h3>{artist.name}</h3>
        {formatCount(artist.album_count || null, 'album') && (
          <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '0.125rem 0 0 0' }}>
            {formatCount(artist.album_count || null, 'album')}
          </p>
        )}
      </div>
    </div>
  );
};

export default ArtistCard;
