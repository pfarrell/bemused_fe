// src/pages/Artist.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import AlbumCard from '../components/AlbumCard';
import Wikipedia from '../components/Wikipedia';
import Loading from '../components/Loading';
import Retry from '../components/Retry';

const Artist = () => {
  const { id, name } = useParams();
  const navigate = useNavigate();
  const [artistData, setArtistData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const { artist, summary, albums } = artistData;

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Artist Header */}
      <div style={{ 
        display: 'flex', 
        gap: '2rem', 
        marginBottom: '3rem', 
        backgroundColor: 'white', 
        padding: '2rem', 
        borderRadius: '8px', 
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' 
      }}>
        {/* Artist Image */}
        <div style={{ flexShrink: 0 }}>
          <img
            src={apiService.getImageUrl(artist.image_path, 'artist_page')}
            alt={artist.name}
            style={{
              height: '300px',
              objectFit: 'cover',
              borderRadius: '8px',
              backgroundColor: '#ddd'
            }}
            onError={(e) => {
              console.log(`Failed to load artist image: ${e.target.src}`);
            }}
          />
        </div>
        
        {/* Artist Info */}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0 0 1rem 0', color: '#1f2937' }}
            onClick={ reload }
          >
            {artist.name}
          </h1>
          
          {/* Wikipedia summary */}
          <Wikipedia summary={summary} />
          
          {/* Artist link */}
          <div style={{ marginTop: '1rem' }}>
            <a 
              href="#" 
              style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem' }}
              onClick={(e) => {
                e.preventDefault();
                console.log('Artist link clicked');
              }}
            >
              {artist.name}
            </a>
          </div>
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
                  artist={artist} 
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
