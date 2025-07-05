// src/pages/Album.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { usePlayerStore } from '../stores/playerStore';
import Wikipedia from '../components/Wikipedia';
import Track from '../components/Track';

const Album = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { playerInstance, currentTrack } = usePlayerStore();
  const [albumData, setAlbumData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchAlbumData = async () => {
      try {
        setLoading(true);
        const response = await apiService.getAlbum(id);
        console.log('Album API Response:', response.data);
        setAlbumData(response.data);
      } catch (error) {
        console.error('Error fetching album data:', error);
        setError('Failed to load album');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchAlbumData();
    }
  }, [id, refreshKey]);

  const reload = () => {
    setRefreshKey(refreshKey + 1)
  }

  const handlePlayNow = () => {
    if (albumData?.tracks && playerInstance) {
      console.log('Playing album now:', albumData.album.title);
      playerInstance.clearPlaylist();
      playerInstance.addTracks(albumData.tracks);
      playerInstance.loadAndPlayTrack(0);
    } else {
      console.log('Player not ready or no tracks');
    }
  };

  const handlePlayNext = () => {
    if (albumData?.tracks && playerInstance) {
      console.log('Added album to play next:', albumData.album.title);
      playerInstance.addTracks(albumData.tracks, true); // true = play next
      
      // If nothing is playing, start playing immediately
      if (playerInstance.audioPlayer.paused) {
        const currentIndex = playerInstance.currentTrackIndex;
        playerInstance.loadAndPlayTrack(currentIndex + 1);
      }
    }
  };

  const handleAddToQueue = () => {
    if (albumData?.tracks && playerInstance) {
      console.log('Added album to queue:', albumData.album.title);
      playerInstance.addTracks(albumData.tracks, false); // false = add to end
      
      // If nothing is playing, start playing immediately
      if (playerInstance.audioPlayer.paused) {
        const playlist = playerInstance.getPlaylist();
        const startIndex = playlist.length - albumData.tracks.length; // First track of the added album
        playerInstance.loadAndPlayTrack(startIndex);
      }
    }
  };

  // Helper function to check if a track is currently playing
  const isTrackPlaying = (track) => {
    return currentTrack && currentTrack.id === track.id;
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100%',
        backgroundColor: '#3a4853'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading album...</p>
        </div>
      </div>
    );
  }

  if (error || !albumData?.album) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100%',
        backgroundColor: '#3a4853'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#ef4444', fontSize: '1.25rem' }}>{error || 'Album not found'}</p>
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

  const { artist, album, tracks, summary } = albumData;

  return (
    <div style={{ padding: '.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Album Header */}
      <div className='media-page-header'>
        {/* Album Cover */}
        <div style={{ flexShrink: 0 }}>
          <img
            src={apiService.getImageUrl(album.image_path, 'album_page')}
            alt={`${album.title} by ${artist.name}`}
            className='full-image'
            onError={(e) => {
              console.log(`Failed to load album image: ${e.target.src}`);
            }}
          />
        </div>
        
        {/* Album Info */}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#7c3aed', cursor: 'pointer' }}
            onClick = {reload}
          >
            {album.title}
          </h1>
          
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'normal', margin: '0 0 1.5rem 0', color: '#7c3aed', cursor: 'pointer' }}
            onClick={() => navigate(`/artist/${artist.id}`)}
          >
            {artist.name}
          </h2>
          {summary && Object.keys(summary).length > 0 && (
            <Wikipedia summary={summary} />
          )}
          
          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button
              onClick={handlePlayNow}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              ▶ Play Now
            </button>
            <button
              onClick={handlePlayNext}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Play Next
            </button>
            <button
              onClick={handleAddToQueue}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Add to Queue
            </button>
          </div>
          
          {/* Album Description */}
          {album.description && (
            <div>
              <p style={{ lineHeight: '1.6', color: '#374151', margin: '0 0 1rem 0' }}>
                {album.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Track List */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '8px', 
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        {tracks.map((track, index) => (
          <Track 
            key={track.id || index}
            track={track} 
            index={index} 
            trackCount={tracks.length}
            isPlaying={isTrackPlaying(track)}
          />
        ))}
      </div>
    </div>
  );
};

export default Album;
