import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

const fieldStyle = {
  width: '100%',
  padding: '0.625rem 0.75rem',
  backgroundColor: '#2c3e50',
  border: '1px solid var(--color-text-secondary)',
  borderRadius: '6px',
  color: 'white',
  fontSize: '1rem',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  color: 'var(--color-border-strong)',
  fontSize: '0.875rem',
  marginBottom: '0.375rem',
};

const btnStyle = {
  padding: '0.625rem 1.25rem',
  backgroundColor: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontSize: '1rem',
  fontWeight: '500',
  cursor: 'pointer',
};

const sectionStyle = {
  backgroundColor: '#1e2d3a',
  borderRadius: '8px',
  padding: '1.5rem',
  marginBottom: '1.5rem',
};

export default function AdminNew() {
  const navigate = useNavigate();

  // Artist form
  const [artistName, setArtistName] = useState('');
  const [savingArtist, setSavingArtist] = useState(false);
  const [lastArtist, setLastArtist] = useState(null);

  // Album form
  const [albumTitle, setAlbumTitle] = useState('');
  const [lastAlbum, setLastAlbum] = useState(null);
  const [artistQuery, setArtistQuery] = useState('');
  const [artistResults, setArtistResults] = useState([]);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [searching, setSearching] = useState(false);
  const [savingAlbum, setSavingAlbum] = useState(false);
  const searchTimeout = useRef(null);

  useEffect(() => {
    if (artistQuery.length < 2) {
      setArtistResults([]);
      return;
    }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiService.searchAdminArtists(artistQuery);
        setArtistResults(res.data);
      } catch {
        setArtistResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [artistQuery]);

  const handleCreateArtist = async (e) => {
    e.preventDefault();
    if (!artistName.trim()) return;
    setSavingArtist(true);
    try {
      const res = await apiService.createArtist(artistName.trim());
      setLastArtist(res.data);
      toast.success(`Created artist "${res.data.name}" (id=${res.data.id})`);
      setArtistName('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create artist');
    } finally {
      setSavingArtist(false);
    }
  };

  const handleCreateAlbum = async (e) => {
    e.preventDefault();
    if (!albumTitle.trim() || !selectedArtist) return;
    setSavingAlbum(true);
    try {
      const res = await apiService.createAlbum(albumTitle.trim(), selectedArtist.id);
      setLastAlbum(res.data);
      toast.success(`Created album "${res.data.title}" (id=${res.data.id})`);
      setAlbumTitle('');
      setArtistQuery('');
      setSelectedArtist(null);
      setArtistResults([]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create album');
    } finally {
      setSavingAlbum(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '600px', margin: '0 auto', color: 'white' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Create New</h1>

      {/* Artist */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Artist</h2>
        <form onSubmit={handleCreateArtist} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input
              type="text"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder="Artist name"
              style={fieldStyle}
              required
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button type="submit" disabled={savingArtist || !artistName.trim()} style={{ ...btnStyle, opacity: (savingArtist || !artistName.trim()) ? 0.5 : 1 }}>
              {savingArtist ? 'Creating...' : 'Create Artist'}
            </button>
            {lastArtist && (
              <span style={{ color: 'var(--color-text-faint)', fontSize: '0.875rem' }}>
                Last created:{' '}
                <span
                  onClick={() => navigate(`/admin/artist/${lastArtist.id}`)}
                  style={{ color: '#93c5fd', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {lastArtist.name} (id={lastArtist.id})
                </span>
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Album */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Album</h2>
        <form onSubmit={handleCreateAlbum} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input
              type="text"
              value={albumTitle}
              onChange={(e) => setAlbumTitle(e.target.value)}
              placeholder="Album title"
              style={fieldStyle}
              required
            />
          </div>

          <div style={{ position: 'relative' }}>
            <label style={labelStyle}>Artist</label>
            {selectedArtist ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#93c5fd' }}>{selectedArtist.name}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedArtist(null); setArtistQuery(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer', fontSize: '1rem' }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={artistQuery}
                  onChange={(e) => { setArtistQuery(e.target.value); setSelectedArtist(null); }}
                  placeholder="Search artist..."
                  style={fieldStyle}
                />
                {(artistResults.length > 0 || searching) && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#2c3e50',
                    border: '1px solid var(--color-text-secondary)',
                    borderRadius: '6px',
                    zIndex: 10,
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}>
                    {searching && <div style={{ padding: '0.5rem 1rem', color: 'var(--color-text-faint)' }}>Searching...</div>}
                    {artistResults.map(a => (
                      <div
                        key={a.id}
                        onClick={() => { setSelectedArtist(a); setArtistQuery(a.name); setArtistResults([]); }}
                        style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--color-text-secondary)' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3a4853'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {a.name}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={savingAlbum || !albumTitle.trim() || !selectedArtist}
              style={{ ...btnStyle, opacity: (savingAlbum || !albumTitle.trim() || !selectedArtist) ? 0.5 : 1 }}
            >
              {savingAlbum ? 'Creating...' : 'Create Album'}
            </button>
            {lastAlbum && (
              <span style={{ color: 'var(--color-text-faint)', fontSize: '0.875rem' }}>
                Last created:{' '}
                <span
                  onClick={() => navigate(`/admin/album/${lastAlbum.id}`)}
                  style={{ color: '#93c5fd', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {lastAlbum.title} (id={lastAlbum.id})
                </span>
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
