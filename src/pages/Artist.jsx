// src/pages/Artist.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import AlbumCard from '../components/AlbumCard';
import Wikipedia from '../components/Wikipedia';
import Loading from '../components/Loading';
import Retry from '../components/Retry';

const Artist = () => {
  const { id, name } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();
  const [artistData, setArtistData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAllSimilar, setShowAllSimilar] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    const fetchArtistData = async () => {
      try {
        setLoading(true);
        const response = await apiService.getArtist(id);
        console.log('Artist API Response:', response.data);
        setArtistData(response.data);
      } catch (error) {
        console.error('Error fetching artist data:', error);
        setError('Failed to load artist');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchArtistData();
    }
  }, [id, refreshKey]);

  const handleAlbumClick = (album) => {
    navigate(`/album/${album.id}`);
  };

  const reload = () => {
    setRefreshKey(refreshKey => refreshKey + 1)
  }


  if (loading) {
    return (
      <Loading message="Loading artist"/>
    );
  }

  if (error || !artistData || !artistData.artist) {
    return (
      <div className="loading-container">
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#ef4444', fontSize: '1.25rem' }}>{error || 'Artist not found'}</p>
          <button 
            onClick={() => navigate('/')}
            style={{ 
              marginTop: '1rem', 
              padding: '0.5rem 1rem', 
              backgroundColor: '#3b82f6', 
              color: 'white', 
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const { artist, summary, albums, appears_on, related_artists, members, member_of, similar_artists } = artistData;

  return (
    <div style={{ padding: '.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Artist Header */}
      <div className='media-page-header'>
        {/* Artist Image */}
        <div style={{ flexShrink: 0 }}>
          <img
            src={apiService.getImageUrl(artist.image_path, 'artist_page')}
            alt={artist.name}
            className='full-image'
            onError={(e) => {
              console.log(`Failed to load artist image: ${e.target.src}`);
            }}
          />
        </div>
        
        {/* Artist Info */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0, color: '#1f2937', cursor: 'pointer' }}
              onClick={ reload }
            >
              {artist.name}
            </h1>
            {isAdmin && (
              <button
                onClick={() => navigate(`/admin/artist/${id}`)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Edit
              </button>
            )}
          </div>

          {/* Wikipedia summary */}
          <Wikipedia summary={summary} />

          {member_of && member_of.length > 0 && (
            <p style={{ fontSize: '0.95rem', margin: '0.5rem 0 0 0', color: '#6b7280' }}>
              Member of:{' '}
              {member_of.map((g, i) => (
                <span key={g.id}>
                  {i > 0 && ' · '}
                  <span
                    style={{ color: '#7c3aed', cursor: 'pointer' }}
                    onClick={() => navigate(`/artist/${g.id}`)}
                  >
                    {g.name}
                  </span>
                </span>
              ))}
            </p>
          )}

          {members && members.length > 0 && (
            <p style={{ fontSize: '0.95rem', margin: '0.5rem 0 0 0', color: '#6b7280' }}>
              Members:{' '}
              {members.map((m, i) => (
                <span key={m.id}>
                  {i > 0 && ' · '}
                  <span
                    style={{ color: '#7c3aed', cursor: 'pointer' }}
                    onClick={() => navigate(`/artist/${m.id}`)}
                  >
                    {m.name}
                  </span>
                </span>
              ))}
            </p>
          )}

          {related_artists && related_artists.length > 0 && (
            <p style={{ fontSize: '0.95rem', margin: '0.5rem 0 0 0', color: '#6b7280' }}>
              Related artists:{' '}
              {related_artists.map((ra, i) => (
                <span key={ra.id}>
                  {i > 0 && ' · '}
                  <span
                    style={{ color: '#7c3aed', cursor: 'pointer' }}
                    onClick={() => navigate(`/artist/${ra.id}`)}
                  >
                    {ra.name}
                  </span>
                </span>
              ))}
            </p>
          )}

          {similar_artists && similar_artists.length > 0 && (() => {
            const cap = isMobile ? 3 : 10;
            const displayed = showAllSimilar ? similar_artists : similar_artists.slice(0, cap);
            const hasMore = similar_artists.length > cap;
            return (
              <p style={{ fontSize: '0.95rem', margin: '0.5rem 0 0 0', color: '#6b7280' }}>
                Similar artists:{' '}
                {displayed.map((sa, i) => (
                  <span key={sa.id}>
                    {i > 0 && ' · '}
                    {sa.has_tracks ? (
                      <span
                        style={{ color: '#7c3aed', cursor: 'pointer' }}
                        onClick={() => navigate(`/artist/${sa.id}`)}
                      >
                        {sa.name}
                      </span>
                    ) : (
                      <span>{sa.name}</span>
                    )}
                  </span>
                ))}
                {hasMore && !showAllSimilar && (
                  <span
                    style={{ color: '#7c3aed', cursor: 'pointer', marginLeft: '0.5rem' }}
                    onClick={() => setShowAllSimilar(true)}
                  >
                    {' '}+{similar_artists.length - cap} more
                  </span>
                )}
                {showAllSimilar && (
                  <span
                    style={{ color: '#7c3aed', cursor: 'pointer', marginLeft: '0.5rem' }}
                    onClick={() => setShowAllSimilar(false)}
                  >
                    {' '}show less
                  </span>
                )}
              </p>
            );
          })()}

        </div>
      </div>

      {/* Albums Grid */}
      {albums && albums.length > 0 && (
        <div className="artist-grid">
          <div className="artist-grid-container">
            {albums.map((album) => {
              const imageUrl = apiService.getImageUrl(album.image_path, 'album_small')
              return (
                <AlbumCard
                  key={album.id}
                  album={album}
                  artist={album.artist}
                  imageUrl={imageUrl}
                  onClick={handleAlbumClick}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Appears On */}
      {appears_on && appears_on.length > 0 && (
        <div className="artist-grid">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '1.5rem 0 0.75rem 0', color: '#1f2937' }}>
            Appears On
          </h2>
          <div className="artist-grid-container">
            {appears_on.map((album) => {
              const imageUrl = apiService.getImageUrl(album.image_path, 'album_small')
              return (
                <AlbumCard
                  key={`appears-${album.id}`}
                  album={album}
                  artist={album.artist}
                  imageUrl={imageUrl}
                  onClick={handleAlbumClick}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Artist;
