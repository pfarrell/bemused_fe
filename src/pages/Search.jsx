// src/pages/Search.jsx
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import Loading from '../components/Loading';
import Track from '../components/Track';
import SearchResultCard from '../components/SearchResultCard';
import SearchTypeFilterPills from '../components/SearchTypeFilterPills';

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [results, setResults] = useState({ results: [], tracks: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTypes, setActiveTypes] = useState(new Set());

  const query = searchParams.get('q') || '';

  const performSearch = async (searchQuery) => {

    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiService.search(searchQuery);
      setResults(response.data);
      setActiveTypes(new Set());

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

  const toggleType = (type) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
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

  const allResults = results.results || [];
  const filteredResults = activeTypes.size === 0
    ? allResults
    : allResults.filter((r) => activeTypes.has(r.type));

  return (
    <div style={{ padding: '.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Ranked results: albums, artists, playlists, collections, interleaved by confidence */}
      {allResults.length > 0 && (
        <div className="search-section">
          <SearchTypeFilterPills results={allResults} activeTypes={activeTypes} onToggle={toggleType} />
          <h2 className="search-section-title">Results ({filteredResults.length})</h2>
          <div className="artist-grid" style={{ padding: '0' }}>
            <div className="artist-grid-container">
              {filteredResults.map((result) => (
                <SearchResultCard
                  key={`${result.type}-${result.data.id}`}
                  type={result.type}
                  data={result.data}
                  onNavigate={navigate}
                  getImageUrl={apiService.getImageUrl}
                />
              ))}
            </div>
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
      {results.results?.length === 0 && results.tracks?.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#6b7280' }}>No results found for "{query}"</p>
        </div>
      )}
    </div>
  );
};

export default Search;
