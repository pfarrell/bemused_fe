// src/components/AlbumGrid.jsx
import { apiService } from '../services/api';

const AlbumGrid = ({ albums, onAlbumClick, imageContext = 'album_small' }) => {
  const handleAlbumClick = (album) => {
    if (onAlbumClick) {
      onAlbumClick(album);
    } else {
      console.log('Navigate to album:', album.id);
    }
  };

  return (
    <div className="album-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 p-4">
      {albums.map((album) => (
        <div
          key={album.id}
          className="album-card cursor-pointer group"
          onClick={() => handleAlbumClick(album)}
        >
          <div className="aspect-square rounded-lg overflow-hidden shadow-md group-hover:shadow-lg transition-shadow">
            <img
              src={apiService.getImageUrl(album.image_path, imageContext)}
              alt={`${album.title} by ${album.artist}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              onError={(e) => {
                // Fallback for missing album art
                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iNDAiIGZpbGw9IiM5Q0EzQUYiLz4KPGNpcmNsZSBjeD0iMTAwIiBjeT0iMTAwIiByPSIxNSIgZmlsbD0iI0YzRjRGNiIvPgo8L3N2Zz4K';
              }}
            />
          </div>
          <div className="mt-2">
            <h3 className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors truncate">
              {album.title}
            </h3>
            <p className="text-xs text-gray-600 truncate">{album.artist}</p>
            {album.year && <p className="text-xs text-gray-500">{album.year}</p>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AlbumGrid;
