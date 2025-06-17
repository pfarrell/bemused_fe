// src/pages/Library.jsx
import { useState, useEffect } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { apiService } from '../services/api';

const Library = () => {
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { setPlaylist } = usePlayerStore();

  useEffect(() => {
    const fetchLibraryData = async () => {
      try {
        setLoading(true);
        const [artistsResponse, albumsResponse] = await Promise.all([
          apiService.getArtists(),
          apiService.getAlbums()
        ]);
        
        setArtists(artistsResponse.data);
        setAlbums(albumsResponse.data);
      } catch (error) {
        console.error('Error fetching library data:', error);
        setError('Failed to load library data');
      } finally {
        setLoading(false);
      }
    };

    fetchLibraryData();
  }, []);

  const handlePlayAlbum = async (album) => {
    try {
      const response = await apiService.getAlbumTracks(album.id);
      setPlaylist(response.data);
    } catch (error) {
      console.error('Error loading album tracks:', error);
    }
  };

  if (loading) return <div className="p-8">Loading library...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="library-page p-8">
      <h1 className="text-3xl font-bold mb-8">Music Library</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Artists</h2>
          <div className="space-y-2">
            {artists.map(artist => (
              <div 
                key={artist.id}
                className="p-4 bg-gray-100 rounded cursor-pointer hover:bg-gray-200"
                onClick={() => console.log('Navigate to artist:', artist.id)}
              >
                <h3 className="font-medium">{artist.name}</h3>
                <p className="text-gray-600 text-sm">{artist.album_count} albums</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4">Recent Albums</h2>
          <div className="space-y-2">
            {albums.map(album => (
              <div 
                key={album.id}
                className="p-4 bg-gray-100 rounded cursor-pointer hover:bg-gray-200"
                onClick={() => handlePlayAlbum(album)}
              >
                <h3 className="font-medium">{album.title}</h3>
                <p className="text-gray-600 text-sm">{album.artist} • {album.year}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Library;
