// src/pages/Search.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import Loading from '../components/Loading';
import Track from '../components/Track';
import SearchResultCard from '../components/SearchResultCard';
import SearchTypeFilterPills from '../components/SearchTypeFilterPills';

const EMPTY_COUNTS = { album: 0, artist: 0, playlist: 0, collection: 0 };
const PAGE_SIZE = 30;

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [results, setResults] = useState({ results: [], tracks: [] });
  const [resultCounts, setResultCounts] = useState(EMPTY_COUNTS);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [activeTypes, setActiveTypes] = useState(new Set());

  const query = searchParams.get('q') || '';
  const seenRef = useRef(new Set());
  const offsetRef = useRef(0);
  const sentinelRef = useRef(null);
  // Bumped at the start of every performSearch call. loadMore captures the
  // current value before its fetch and checks it again after — if a new
  // search started in between, the value has moved on and the now-stale
  // loadMore response is dropped instead of being merged into the new
  // query's results.
  const searchGenerationRef = useRef(0);

  const performSearch = async (searchQuery) => {

    if (!searchQuery.trim()) return;

    searchGenerationRef.current += 1;
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.search(searchQuery);
      const data = response.data;
      setResults(data);
      setResultCounts(data.resultCounts || EMPTY_COUNTS);
      setHasMore(!!data.hasMore);
      setActiveTypes(new Set());

      seenRef.current = new Set((data.results || []).map((r) => `${r.type}:${r.data.id}`));
      offsetRef.current = PAGE_SIZE;

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

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !query) return;
    const generation = searchGenerationRef.current;
    setLoadingMore(true);

    try {
      const response = await apiService.search(query, offsetRef.current);
      if (generation !== searchGenerationRef.current) return; // superseded by a new search
      const data = response.data;
      const fresh = (data.results || []).filter((r) => !seenRef.current.has(`${r.type}:${r.data.id}`));
      fresh.forEach((r) => seenRef.current.add(`${r.type}:${r.data.id}`));

      setResults((prev) => ({ ...prev, results: [...prev.results, ...fresh] }));
      setResultCounts(data.resultCounts || EMPTY_COUNTS);
      setHasMore(!!data.hasMore);
      offsetRef.current += PAGE_SIZE;
    } catch (err) {
      console.error('Load more search results error:', err);
      setError('Failed to load more results.');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, query]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      {
        root: document.querySelector('.main-content'),
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

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
  const totalResultCount = Object.values(resultCounts).reduce((sum, n) => sum + n, 0);

  return (
    <div style={{ padding: '.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Ranked results: albums, artists, playlists, collections, interleaved by confidence */}
      {allResults.length > 0 && (
        <div className="search-section">
          <SearchTypeFilterPills counts={resultCounts} activeTypes={activeTypes} onToggle={toggleType} />
          <h2 className="search-section-title">Results ({totalResultCount})</h2>
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
          {hasMore && <div ref={sentinelRef} style={{ height: '1px' }} />}
          {loadingMore && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
              <div className="loading-spinner" />
            </div>
          )}
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
