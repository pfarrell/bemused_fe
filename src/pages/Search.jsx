// src/pages/Search.jsx
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import Loading from '../components/Loading';

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

  const handleTrackClick = (track) => {
    console.log('Play track:', track);
    // TODO: Add to playlist and play
  };

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
    <div>
      {/* Artists Section */}
      {results.artists && results.artists.length > 0 && (
        <div className="search-section">
          <h2 className="search-section-title">Artists ({results.artists.length})</h2>
          <div className="artist-grid" style={{ padding: '0' }}>
            <div className="artist-grid-container">
              {results.artists.map((artist) => (
                <div
                  key={artist.id}
                  className="artist-card"
                  onClick={() => navigate(`/artist/${artist.id}`)}
                >
                  <div className="artist-card-image">
                    <img
                      src={apiService.getImageUrl(artist.image_path, 'artist_search')}
                      alt={artist.name}
                      onError={(e) => {
                        console.log(`Failed to load artist image: ${e.target.src}`);
                      }}
                    />
                  </div>
                  <div className="artist-card-title">
                    <h3>{artist.name}</h3>
                  </div>
                </div>
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
                <div
                  key={album.id}
                  className="artist-card"
                  onClick={() => navigate(`/album/${album.id}`)}
                >
                  <div className="artist-card-image">
                    <img
                      src={apiService.getImageUrl(album.image_path, 'album_small')}
                      alt={`${album.title} by ${album.artist}`}
                      onError={(e) => {
                        console.log(`Failed to load album image: ${e.target.src}`);
                      }}
                    />
                  </div>
                  <div className="artist-card-title">
                    <h3>{album.title}</h3>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
                      {album.artist}
                    </p>
                  </div>
                </div>
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
                    {playlist.track_count} tracks
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
              <div 
                key={track.id || index}
                className="track-item"
                onClick={() => handleTrackClick(track)}
              >
                <div className="track-play-button">
                  <span style={{ fontSize: '0.75rem' }}>▶</span>
                </div>
                <div className="track-info">
                  <h4 className="track-title">{track.title}</h4>
                  <p className="track-artist-album">
                    <a href="#" onClick={(e) => { 
                      e.stopPropagation(); 
                      if (track.artist_id) {
                        navigate(`/artist/${track.artist_id}`);
                      } else {
                        console.log('Go to artist:', track.artist); 
                      }
                    }}>
                      {track.artist}
                    </a>
                    {track.album && (
                      <>
                        {' '} 
                        <a href="#" onClick={(e) => { 
                          e.stopPropagation(); 
                          if (track.album_id) {
                            navigate(`/album/${track.album_id}`);
                          } else {
                            console.log('Go to album:', track.album); 
                          }
                        }}>
                          {track.album}
                        </a>
                      </>
                    )}
                  </p>
                </div>
                {track.duration && (
                  <div className="track-duration">{track.duration}</div>
                )}
              </div>
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
