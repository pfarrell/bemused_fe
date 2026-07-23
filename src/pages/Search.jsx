// src/pages/Search.jsx
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import Loading from '../components/Loading';
import Track from '../components/Track';
import AlbumCard from '../components/AlbumCard';
import ArtistCard from '../components/ArtistCard';
import { formatCount } from '../utils/formatters';

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [results, setResults] = useState({ artists: [], albums: [], tracks: [], playlists: [] });
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
      
      if (searchQuery !== query) {
        setSearchParams({ q: searchQuery });
      }
    } catch (error) {
      const err = error
      console.error('Search error:', err);
      if(err.response && err.response.data) {
        setError(`${err.response.data}`)
      } else {
        setError('Search failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (query) {
      performSearch(query);
    }
  }, [query]);

  const handlePlaylistClick = (playlist) => {
    console.log('Load playlist:', playlist.id);
  };

  if (loading) {
    return (
      <Loading message="Searching" />
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: '#ef4444', fontSize: '1.125rem' }}>{error}</p>
      </div>
    );
  }

  if (!query) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: '#6b7280' }}>Enter a search term to find music</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Artists Section */}
      {results.artists && results.artists.length > 0 && (
        <div className="search-section">
          <h2 className="search-section-title">Artists ({results.artists.length})</h2>
          <div className="artist-grid" style={{ padding: '0' }}>
            <div className="artist-grid-container">
              {results.artists.map((artist) => (
                <ArtistCard
                  key={artist.id}
                  artist={artist}
                  imageUrl={apiService.getImageUrl(artist.image_path, 'artist_search')}
                  onClick={(a) => navigate(`/artist/${a.id}`)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Albums Section */}
      {results.albums && results.albums.length > 0 && (
        <div className="search-section">
          <h2 className="search-section-title">Albums ({results.albums.length})</h2>
          <div className="artist-grid" style={{ padding: '0' }}>
            <div className="artist-grid-container">
              {results.albums.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  artist={album.artist}
                  imageUrl={apiService.getImageUrl(album.image_path, 'album_small')}
                  onClick={(a) => navigate(`/album/${a.id}`)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Playlists Section */}
      {results.playlists && results.playlists.length > 0 && (
        <div className="search-section">
          <h2 className="search-section-title">Playlists ({results.playlists.length})</h2>
          <div className="track-list">
            {results.playlists.map((playlist) => (
              <div 
                key={playlist.id}
                className="track-item"
                onClick={() => handlePlaylistClick(playlist)}
              >
                <div className="track-play-button">
                  <span style={{ fontSize: '0.75rem' }}>♪</span>
                </div>
                <div className="track-info">
                  <h4 className="track-title">{playlist.name}</h4>
                  <p className="track-artist-album">
                    {formatCount(playlist.track_count || null, 'track')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tracks Section */}
      {results.tracks && results.tracks.length > 0 && (
        <div className="search-section">
          <h2 className="search-section-title">Tracks ({results.tracks.length})</h2>
          <div className="track-list">
            {results.tracks.map((track, index) => (
              <Track key={track.id} track={track} index={index} trackCount={results.tracks.length} includeMeta={true}/>
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {results.artists?.length === 0 && 
       results.albums?.length === 0 && 
       results.tracks?.length === 0 && 
       results.playlists?.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#6b7280' }}>No results found for "{query}"</p>
        </div>
      )}
    </div>
  );
};

export default Search;
