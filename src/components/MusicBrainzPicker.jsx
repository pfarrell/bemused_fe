import { useState } from 'react';
import { apiService } from '../services/api';

const MB_URL_BASE = {
  artist: 'https://musicbrainz.org/artist/',
  release: 'https://musicbrainz.org/release/',
};

const UUID_IN_TEXT_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const displayId = (raw) => {
  const match = raw.match(UUID_IN_TEXT_RE);
  return match ? match[0] : raw;
};

const MusicBrainzPicker = ({ entityType, value, mbidStatus, searchDefault, pending, onChange }) => {
  const [pasteText, setPasteText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState(searchDefault || '');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [pickedName, setPickedName] = useState(null);

  const handleUse = () => {
    if (!pasteText.trim()) return;
    onChange(pasteText.trim());
    setPickedName(null);
    setPasteText('');
  };

  const handleToggleSearch = () => {
    setSearchOpen((open) => !open);
    setResults([]);
    setSearchError(null);
    setHasSearched(false);
  };

  const handleSearch = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      const response = entityType === 'artist'
        ? await apiService.searchMusicbrainzArtist(query)
        : await apiService.searchMusicbrainzRelease(query);
      setResults(response.data || []);
      setHasSearched(true);
    } catch (err) {
      setSearchError(err.response?.data?.error || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handlePick = (candidate) => {
    onChange(candidate.id);
    setPickedName(entityType === 'artist' ? candidate.name : candidate.title);
    setResults([]);
    setSearchOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setPickedName(null);
  };

  const statusLabel = mbidStatus === 'not_found'
    ? 'Not found on MusicBrainz'
    : mbidStatus === 'low_confidence'
      ? 'Low confidence match'
      : 'Not yet looked up';
  const statusText = mbidStatus === 'manual' ? 'manually set' : mbidStatus;

  return (
    <div>
      {value ? (
        <a
          href={`${MB_URL_BASE[entityType]}${displayId(value)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#3b82f6', fontSize: '0.875rem', wordBreak: 'break-all' }}
        >
          {displayId(value)}
        </a>
      ) : (
        <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>{statusLabel}</span>
      )}
      {mbidStatus && (
        <small style={{ display: 'block', color: '#9ca3af', marginTop: '0.25rem' }}>
          Status: {statusText}
        </small>
      )}
      {pending && (
        <small style={{ display: 'block', color: '#16a34a', marginTop: '0.25rem' }}>
          Pending — click Save to apply{pickedName ? ` "${pickedName}"` : ''}
        </small>
      )}

      <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            type="text"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleUse(); } }}
            placeholder="Paste MusicBrainz ID or URL"
            style={{ width: '100%', boxSizing: 'border-box', padding: '0.4rem', fontSize: '0.8rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
          />
        </div>
        <button
          type="button"
          onClick={handleUse}
          disabled={!pasteText.trim()}
          style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', cursor: pasteText.trim() ? 'pointer' : 'not-allowed' }}
        >
          Use
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button type="button" onClick={handleToggleSearch} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', cursor: 'pointer' }}>
          {searchOpen ? 'Cancel Search' : 'Search MusicBrainz'}
        </button>
        {value && (
          <button type="button" onClick={handleClear} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', cursor: 'pointer' }}>
            Clear
          </button>
        )}
      </div>

      {searchOpen && (
        <div style={{ marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setResults([]); setHasSearched(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(e); } }}
                placeholder={entityType === 'artist' ? 'Search artist name...' : 'Search release title...'}
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.4rem', fontSize: '0.8rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
              />
            </div>
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching || query.trim().length < 2}
              style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', cursor: searching || query.trim().length < 2 ? 'not-allowed' : 'pointer' }}
            >
              {searching ? '...' : 'Search'}
            </button>
          </div>
          {searchError && (
            <small style={{ display: 'block', color: '#dc2626', marginTop: '0.25rem' }}>{searchError}</small>
          )}
          {hasSearched && !searching && !searchError && results.length === 0 && (
            <small style={{ display: 'block', color: '#9ca3af', marginTop: '0.25rem' }}>No matches found.</small>
          )}
          {results.length > 0 && (
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '4px', marginTop: '0.25rem' }}>
              {results.map((candidate) => (
                <div
                  key={candidate.id}
                  onClick={() => handlePick(candidate)}
                  style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  <div>{entityType === 'artist' ? candidate.name : candidate.title}</div>
                  {candidate.disambiguation && (
                    <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>{candidate.disambiguation}</div>
                  )}
                  <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
                    {entityType === 'artist'
                      ? [candidate.type, candidate.country, candidate.life_span].filter(Boolean).join(' · ')
                      : [candidate.artist_credit, candidate.date, candidate.track_count ? `${candidate.track_count} tracks` : null].filter(Boolean).join(' · ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MusicBrainzPicker;
