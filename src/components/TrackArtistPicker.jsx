import { useState } from 'react';
import { apiService } from '../services/api';

const TrackArtistPicker = ({ artistName, onSelect, startEditing = false }) => {
  const [editing, setEditing] = useState(startEditing);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (query.length < 2) return;
    setSearching(true);
    try {
      const response = await apiService.searchAdminArtists(query);
      setResults(response.data || []);
    } catch (err) {
      console.error('Artist search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handlePick = (artist) => {
    onSelect(artist.id, artist.name);
    setEditing(false);
    setQuery('');
    setResults([]);
  };

  const handleCancel = () => {
    setEditing(false);
    setQuery('');
    setResults([]);
  };

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>{artistName || 'Unassigned'}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', cursor: 'pointer' }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setResults([]); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(e); } }}
          placeholder="Search artist name..."
          autoFocus
          style={{ width: '140px', padding: '0.25rem', fontSize: '0.8rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching || query.length < 2}
          style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', cursor: searching || query.length < 2 ? 'not-allowed' : 'pointer' }}
        >
          {searching ? '...' : 'Search'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
      {results.length > 0 && (
        <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '4px', backgroundColor: 'var(--color-bg-surface)', marginTop: '0.25rem' }}>
          {results.map((artist) => (
            <div
              key={artist.id}
              onClick={() => handlePick(artist)}
              style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              {artist.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrackArtistPicker;
