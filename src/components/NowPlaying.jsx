// src/components/player/NowPlaying.jsx
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../stores/playerStore';

const NowPlaying = () => {
  const navigate = useNavigate();
  const { currentTrack } = usePlayerStore();
  const handleArtistClick = (track) => {
    navigate(`/artist/${track.artist.id}`);
  };

  const handleTrackClick = (track) => {
    navigate(`/album/${track.album.id}`);
  };


  // Don't show on mobile or when no track is playing
  if (!currentTrack) {
    return null;
  }

  return (
    <div className="now-playing">
      <svg 
        width="24" 
        height="24" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth="2" 
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
        />
      </svg>
      <div className="track-info show">
        <div className="track-artist" onClick={() => handleArtistClick(currentTrack)} title="go to artist">
          {currentTrack.artist?.name || currentTrack.artist || 'Unknown Artist'}
        </div>
        <div className="track-title" onClick={() => handleTrackClick(currentTrack)} title="go to album">
          {currentTrack.title}
        </div>
      </div>
    </div>
  );
};

export default NowPlaying;
