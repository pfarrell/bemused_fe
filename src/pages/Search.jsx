// src/pages/Search.jsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiService } from '../services/api';
import ArtistGrid from '../components/ArtistGrid';
import AlbumGrid from '../components/AlbumGrid';
import SearchBar from '../components/SearchBar';

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [results, setResults] = useState({ artists: [], albums: [], tracks: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const query = searchParams.get('q') || '';

  const performSearch = async (searchQuery) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    
    try {
      const response = await apiService.search(searchQuery);
      setResults(response.data);
      
      // Update URL if this was a new search
      if (searchQuery !== query) {
        setSearchParams({ q: searchQuery });
      }
    } catch (error) {
      console.error('Search error:', error);
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (query) {
      performSearch(query);
    }
  }, [query]);

  const handleArtistClick = (artist) => {
    // TODO: Navigate to artist page
    console.log('Navigate to artist:', artist.id);
  };

  const handleAlbumClick = (album) => {
    // TODO: Navigate to album page or play album
    console.log('Navigate to album:', album.id);
  };

  return (
    <div className="search-page min-h-screen bg-gray-50">
      {/* Header with search */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">P-Share</h1>
            <SearchBar 
              onSearch={performSearch} 
              className="flex-1 max-w-2xl"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Searching...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-600 text-xl">{error}</p>
          </div>
        )}

        {!loading && !error && query && (
          <>
            <h2 className="text-xl font-semibold mb-4">
              Search results for "{query}"
            </h2>

            {/* Artists */}
            {results.artists && results.artists.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-medium mb-4">Artists</h3>
                <ArtistGrid 
                  artists={results.artists} 
                  onArtistClick={handleArtistClick}
                  imageContext="artist_search"
                />
              </div>
            )}

            {/* Albums */}
            {results.albums && results.albums.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-medium mb-4">Albums</h3>
                <AlbumGrid 
                  albums={results.albums} 
                  onAlbumClick={handleAlbumClick}
                  imageContext="album_small"
                />
              </div>
            )}

            {/* Tracks */}
            {results.tracks && results.tracks.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-medium mb-4">Tracks</h3>
                <div className="bg-white rounded-lg shadow">
                  {results.tracks.map((track, index) => (
                    <div 
                      key={track.id || index}
                      className="p-4 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                      onClick={() => console.log('Play track:', track)}
                    >
                      <h4 className="font-medium">{track.title}</h4>
                      <p className="text-gray-600 text-sm">{track.artist} • {track.album}</p>
                      {track.duration && (
                        <p className="text-gray-500 text-xs">{track.duration}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No results */}
            {results.artists?.length === 0 && 
             results.albums?.length === 0 && 
             results.tracks?.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600">No results found for "{query}"</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Search;
