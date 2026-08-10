// src/pages/Collections.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import Loading from '../components/Loading';
import Retry from '../components/Retry';
import CollectionResultCard from '../components/CollectionResultCard';
import CoverCollage from '../components/CoverCollage';
import { useIsMobile } from '../hooks/useIsMobile';

export default function Collections() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getCollections();
      setCollections(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <Retry message={error} onRetry={loadCollections} />;

  return (
    <div style={{ padding: '2rem', paddingBottom: '8rem', maxWidth: '1400px', margin: '0 auto' }}>
      {collections.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p style={{ fontSize: '1.125rem' }}>No collections found</p>
        </div>
      ) : isMobile ? (
        <div className="artist-grid">
          <div className="artist-grid-container">
            {collections.map((collection) => (
              <CollectionResultCard
                key={collection.id}
                collection={collection}
                imageUrl={apiService.getImageUrl(collection.image_path, 'album_small')}
                previewAlbums={collection.preview_albums}
                onClick={() => navigate(`/collection/${collection.id}`)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="artist-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '1.5rem'
        }}>
          {collections.map((collection) => (
            <div
              key={collection.id}
              onClick={() => navigate(`/collection/${collection.id}`)}
              style={{
                cursor: 'pointer',
                backgroundColor: 'white',
                borderRadius: '0.5rem',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                overflow: 'hidden',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{
                width: '100%',
                paddingBottom: '100%',
                position: 'relative',
                backgroundColor: '#e5e7eb'
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                  <CoverCollage
                    imagePath={collection.image_path}
                    items={collection.preview_albums}
                    alt={collection.name}
                    placeholderGlyph="▣"
                    imageContext="album_small"
                  />
                </div>
              </div>

              <div style={{ padding: '1rem' }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {collection.name}
                </h3>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
