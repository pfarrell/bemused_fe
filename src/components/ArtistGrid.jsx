// src/components/ArtistGrid.jsx
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import ArtistCard from './ArtistCard';

const ArtistGrid = ({ artists, onArtistClick, imageContext = 'base', gridRef, sentinelRef }) => {
  const navigate = useNavigate();

  const handleArtistClick = (artist) => {
    if (onArtistClick) {
      onArtistClick(artist);
    } else {
      navigate(`/artist/${artist.id}`);
    }
  };

  return (
    <div className="artist-grid">
      <div className="artist-grid-container" ref={gridRef}>
        {artists.map((artist) => (
          <ArtistCard
            key={artist.id}
            artist={artist}
            imageUrl={apiService.getImageUrl(artist.image_path, imageContext)}
            onClick={handleArtistClick}
          />
        ))}
      </div>
      {sentinelRef && <div ref={sentinelRef} style={{ height: '1px' }} />}
    </div>
  );
};

export default ArtistGrid;
