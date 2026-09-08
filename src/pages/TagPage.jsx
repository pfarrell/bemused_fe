import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import AlbumGrid from '../components/AlbumGrid';
import ArtistGrid from '../components/ArtistGrid';
import Loading from '../components/Loading';

const TagPage = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await apiService.getTagContent(name);
        setData(res.data);
      } catch {
        setError('Failed to load tag');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [name]);

  if (loading) return <Loading message={`Loading #${name}`} />;

  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#ef4444', textAlign: 'center' }}>
        <p>{error}</p>
        <button onClick={() => navigate(-1)} style={{ marginTop: '1rem', cursor: 'pointer' }}>
          Go back
        </button>
      </div>
    );
  }

  const { albums = [], artists = [] } = data;

  if (albums.length === 0 && artists.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-faint)' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--color-border)' }}>
          #{name}
        </h1>
        <p>Nothing tagged with <strong>#{name}</strong> yet.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--color-border)' }}>
        #{name}
      </h1>

      {albums.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Albums ({albums.length})
          </h2>
          <AlbumGrid albums={albums} />
        </>
      )}

      {artists.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: '1.5rem 0 0.75rem 0', color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Artists ({artists.length})
          </h2>
          <ArtistGrid artists={artists} imageContext="artist_search" />
        </>
      )}
    </div>
  );
};

export default TagPage;
