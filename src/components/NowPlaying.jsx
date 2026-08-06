// src/components/player/NowPlaying.jsx
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../stores/playerStore';
import { apiService } from '../services/api';

const NowPlaying = () => {
  const navigate = useNavigate();
  const { currentTrack, closeDrawer } = usePlayerStore();
  const handleArtistClick = (track) => {
    navigate(`/artist/${track.artist.id}`);
    closeDrawer();
  };

  const handleTrackClick = (track) => {
    if (track.source_playlist?.id) {
      navigate(`/playlist/${track.source_playlist.id}`);
    } else {
      navigate(`/album/${track.album.id}`);
    }
    closeDrawer();
  };

  // Don't show on mobile or when no track is playing
  if (!currentTrack) {
    return null;
  }

  // Every backend route puts the album art path at the track's top level
  // (image_path), not nested under album.image_path — the nested album
  // object only ever carries id/title/artist for navigation.
  const albumArtUrl = currentTrack.image_path
    ? apiService.getImageUrl(currentTrack.image_path, 'album_small')
    : null;

  return (
    <div className="now-playing">
      {albumArtUrl ? (
        <img
          src={albumArtUrl}
          alt={currentTrack.album?.title}
          className="now-playing-art"
        />
      ) : (
        <svg
          width="24" height="24" fill="none" stroke="currentColor"
          viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      )}
      <div className="track-info show">
        <div className="track-artist" onClick={() => handleArtistClick(currentTrack)} title="go to artist">
          {currentTrack.artist?.name || 'Unknown Artist'}
        </div>
        <div
          className="track-title"
          onClick={() => handleTrackClick(currentTrack)}
          title={currentTrack.source_playlist?.id ? 'go to playlist' : 'go to album'}
        >
          {currentTrack.title}
        </div>
      </div>
    </div>
  );
};

export default NowPlaying;
