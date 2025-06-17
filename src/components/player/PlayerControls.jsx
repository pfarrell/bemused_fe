import { usePlayerStore } from '../../stores/playerStore';

const PlayerControls = () => {
  const {
    currentTrack,
    isPlaying,
    play,
    pause,
    skipNext,
    skipPrevious
  } = usePlayerStore();

  if (!currentTrack) return null;

  return (
    <div className="player-controls flex items-center gap-4 p-4 bg-gray-100">
      <div className="track-info flex-1">
        <h3 className="font-semibold">{currentTrack.title}</h3>
        <p className="text-gray-600">{currentTrack.artist}</p>
      </div>
      
      <div className="controls flex gap-2">
        <button onClick={skipPrevious} className="p-2">⏮️</button>
        <button 
          onClick={isPlaying ? pause : play}
          className="p-2"
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        <button onClick={skipNext} className="p-2">⏭️</button>
      </div>
    </div>
  );
};

export default PlayerControls;
