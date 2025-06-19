// src/components/ArtistGrid.jsx
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

const ArtistGrid = ({ artists, onArtistClick, imageContext = 'base' }) => {
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
      <div className="artist-grid-container">
        {artists.map((artist) => {
          const imageUrl = apiService.getImageUrl(artist.image_path, imageContext);
          console.log(`id: ${artist.id} Artist: ${artist.name}, Image Path: ${artist.image_path}, Final URL: ${imageUrl}`);
          
          return (
            <div
              key={artist.id}
              className="artist-card"
              onClick={() => handleArtistClick(artist)} // Move onClick to entire card
            >
              <div className="artist-card-image">
                <img
                  src={imageUrl}
                  alt={artist.name}
                  onError={(e) => {
                    console.log(`Failed to load image: ${e.target.src}`);
                    console.log(`Artist: ${artist.name}, Image path: ${artist.image_path}`);
                  }}
                />
              </div>
              
              <div className="artist-card-title">
                <h3>{artist.name}</h3>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ArtistGrid;
