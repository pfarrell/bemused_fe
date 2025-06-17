// src/components/ArtistGrid.jsx
import { apiService } from '../services/api';

const ArtistGrid = ({ artists, onArtistClick, imageContext = 'base' }) => {
  const handleArtistClick = (artist) => {
    if (onArtistClick) {
      onArtistClick(artist);
    } else {
      console.log('Navigate to artist:', artist.id);
    }
  };

  return (
    <div className="artist-grid p-4" style={{ backgroundColor: '#f5f5f5' }}>
      {/* Explicit CSS Grid with 6 columns to match your screenshot */}
      <div 
        className="grid gap-4"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          maxWidth: '1400px',
          margin: '0 auto'
        }}
      >
        {artists.map((artist) => {
          const imageUrl = apiService.getImageUrl(artist.image_path, imageContext);
          console.log(`Artist: ${artist.name}, Image Path: ${artist.image_path}, Final URL: ${imageUrl}`);
          
          return (
            <div
              key={artist.id}
              className="artist-card cursor-pointer group text-center"
              onClick={() => handleArtistClick(artist)}
            >
              {/* Image container */}
              <div 
                className="w-full rounded-lg overflow-hidden shadow-lg group-hover:shadow-xl transition-all duration-200"
                style={{ 
                  aspectRatio: '1 / 1',
                  backgroundColor: '#ddd'
                }}
              >
                <img
                  src={imageUrl}
                  alt={artist.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onLoad={() => console.log(`Successfully loaded: ${imageUrl}`)}
                  onError={(e) => {
                    console.log(`Failed to load image: ${e.target.src}`);
                    console.log(`Artist: ${artist.name}, Image path: ${artist.image_path}`);
                    // Keep the default broken image behavior for now to debug
                  }}
                />
              </div>
              
              {/* Artist name */}
              <div className="mt-2 px-1">
                <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">
                  {artist.name}
                </h3>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ArtistGrid;
