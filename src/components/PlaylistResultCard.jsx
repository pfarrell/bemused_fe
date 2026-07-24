// src/components/PlaylistResultCard.jsx
import { useState } from 'react';
import { formatCount } from '../utils/formatters';
import { apiService } from '../services/api';
import { usePlayerStore } from '../stores/playerStore';
import ResultRow from './ResultRow';
import { useIsMobile } from '../hooks/useIsMobile';

const PlaylistResultCard = ({ playlist, onClick, imageUrl }) => {
  const isMobile = useIsMobile();
  const [playLoading, setPlayLoading] = useState(false);
  const { clearPlaylist, addTracks } = usePlayerStore();

  const handleImageError = (e) => {
    if (e.target.src.includes('/sm/')) {
      e.target.src = e.target.src.replace('/sm/', '/');
      e.target.onerror = null;
    }
  };

  const handlePlayAll = async () => {
    setPlayLoading(true);
    try {
      const response = await apiService.getPlaylist(playlist.id);
      clearPlaylist();
      addTracks(response.data.tracks);
    } catch (err) {
      console.error('Failed to play playlist', err);
    } finally {
      setPlayLoading(false);
    }
  };

  if (isMobile) {
    const trackCount = formatCount(playlist.track_count || null, 'track');
    return (
      <ResultRow
        imageUrl={imageUrl}
        imageShape="square"
        title={playlist.name}
        subtitle={trackCount ? `Playlist · ${trackCount}` : 'Playlist'}
        onClick={() => onClick(playlist)}
        onImageError={handleImageError}
        play={{ loading: playLoading, onPlay: handlePlayAll, label: `Play ${playlist.name}` }}
      />
    );
  }

  return (
    <div className="artist-card" onClick={() => onClick(playlist)}>
      <div className="artist-card-image">
        <img
          src={imageUrl}
          alt={playlist.name}
          onError={handleImageError}
        />
      </div>
      <div className="artist-card-title">
        <h3>{playlist.name}</h3>
        {formatCount(playlist.track_count || null, 'track') && (
          <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '0.125rem 0 0 0' }}>
            {formatCount(playlist.track_count || null, 'track')}
          </p>
        )}
      </div>
    </div>
  );
};

export default PlaylistResultCard;
