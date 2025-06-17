// components/player/AudioPlayerWrapper.jsx
import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../stores/playerStore';

import * as MusicPlayer from 'music-player';

const AudioPlayerWrapper = ({ className = "" }) => {
  const audioRef = useRef();
  const containerRef = useRef();
  const playlistRef = useRef();
  
  const {
    playlist,
    setCurrentTrack,
    setIsPlaying,
    setPlayerInstance
  } = usePlayerStore();

  useEffect(() => {
    if (audioRef.current && containerRef.current && playlistRef.current) {
      // Create the audio player instance
      const player = new AudioPlayer(
        playlist,
        audioRef.current,           // audioElement
        containerRef.current,       // containerElement  
        playlistRef.current,        // playlistElement
        {
          shuffle: false,
          onTrackStart: (track) => {
            console.log('Track started:', track);
            setCurrentTrack(track);
            setIsPlaying(true);
          },
          onFiveSecondMark: (track) => {
            console.log('5 seconds into:', track.title);
            // Here you could make API calls to update play counts
          },
          getTrackPrefix: (track, index) => {
            // You can customize track prefixes here
            return '';
          }
        }
      );

      // Store the player instance for external control
      setPlayerInstance(player);

      // Cleanup function
      return () => {
        setPlayerInstance(null);
      };
    }
  }, []); // Empty dependency - only run once

  // Update playlist when it changes from outside
  useEffect(() => {
    const { playerInstance } = usePlayerStore.getState();
    if (playerInstance && playlist.length > 0) {
      playerInstance.clearPlaylist();
      playerInstance.addTracks(playlist);
    }
  }, [playlist]);

  return (
    <div className={`audio-player-wrapper ${className}`}>
      {/* Audio element - hidden since your player has its own controls */}
      <audio ref={audioRef} style={{ display: 'none' }} />
      
      {/* Container for your player's controls */}
      <div ref={containerRef} className="player-controls-container" />
      
      {/* Container for your player's playlist UI */}
      <div ref={playlistRef} className="player-playlist-container" />
    </div>
  );
};

export default AudioPlayerWrapper;
