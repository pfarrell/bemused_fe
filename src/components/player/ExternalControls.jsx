// components/player/ExternalControls.jsx
import { usePlayerStore } from '../../stores/playerStore';

const ExternalControls = () => {
  const { currentTrack, isPlaying, playerInstance } = usePlayerStore();

  const handleAddToQueue = (track) => {
    if (playerInstance) {
      playerInstance.addTrack(track);
    }
  };

  const handleClearPlaylist = () => {
    if (playerInstance) {
      playerInstance.clearPlaylist();
    }
  };

  if (!currentTrack) {
    return (
      <div className="external-controls p-4">
        <p>No track loaded</p>
        <button 
          onClick={handleClearPlaylist}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Clear Playlist
        </button>
      </div>
    );
  }

  return (
    <div className="external-controls p-4 bg-gray-50">
      <h3 className="font-semibold">Now Playing</h3>
      <p>{currentTrack.title} - {currentTrack.artist}</p>
      <p>Status: {isPlaying ? 'Playing' : 'Paused'}</p>
      
      <div className="flex gap-2 mt-2">
        <button 
          onClick={handleClearPlaylist}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Clear Playlist
        </button>
      </div>
    </div>
  );
};

export default ExternalControls;
