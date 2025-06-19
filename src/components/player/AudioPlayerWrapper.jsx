// src/components/player/AudioPlayerWrapper.jsx
import { useEffect, useState, useRef } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { apiService } from '../../services/api';
import * as MusicPlayer from 'music-player';

const AudioPlayerWrapper = ({ className = "" }) => {
  const audioRef = useRef();
  const containerRef = useRef();
  const playlistRef = useRef();
  const playerInstanceRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  
  const {
    playlist,
    setCurrentTrack,
    setIsPlaying,
    setPlayerInstance
  } = usePlayerStore();

  // Load the player script if needed
  useEffect(() => {
    const loadPlayerScript = () => {
      if (typeof window.AudioPlayer !== 'undefined') {
        setIsPlayerReady(true);
        return;
      }

      const script = document.createElement('script');
      script.src = '/player.js'; // Adjust this path to where your player.js is served
      script.onload = () => {
        setIsPlayerReady(true);
      };
      script.onerror = () => {
        console.error('Failed to load music player script');
      };
      document.head.appendChild(script);

      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    };

    loadPlayerScript();
  }, []);

  // Initialize the player when ready
  useEffect(() => {
    if (!isPlayerReady || !audioRef.current || !containerRef.current || !playlistRef.current) {
      return;
    }

    try {
      const player = new window.AudioPlayer(
        [], // Start with empty playlist
        audioRef.current,
        containerRef.current,
        playlistRef.current,
        {
          shuffle: false,
          onTrackStart: (track) => {
            console.log('Track started:', track);
            setCurrentTrack(track);
            setIsPlaying(true);
          },
          onFiveSecondMark: (track) => {
            apiService.log(track.id);
            console.log('5 seconds into:', track.title);
          },
          getTrackPrefix: (track, index) => {
            return ''; // You can customize this
          }
        }
      );

      playerInstanceRef.current = player;
      setPlayerInstance(player);

      console.log('Music player initialized successfully');

    } catch (error) {
      console.error('Error initializing music player:', error);
    }

    return () => {
      if (playerInstanceRef.current) {
        // Clean up if your player has a destroy method
        playerInstanceRef.current = null;
      }
      setPlayerInstance(null);
    };
  }, [isPlayerReady, setCurrentTrack, setIsPlaying, setPlayerInstance]);

  // Update playlist when it changes
  useEffect(() => {
    if (playerInstanceRef.current && playlist.length > 0) {
      try {
        playerInstanceRef.current.clearPlaylist();
        playerInstanceRef.current.addTracks(playlist);
        console.log('Playlist updated with', playlist.length, 'tracks');
      } catch (error) {
        console.error('Error updating playlist:', error);
      }
    }
  }, [playlist]);

  return (
    <div className={`music-player-wrapper h-full ${className}`}>
      {/* Audio element - hidden but accessible to your player */}
      <audio 
        ref={audioRef} 
        style={{ display: 'none' }}
        preload="metadata"
      />
      
      {/* Container where your player controls will be rendered */}
      <div 
        ref={containerRef} 
        className="player-controls-container w-full h-full"
        style={{ 
          minHeight: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {!isPlayerReady && (
          <div style={{ color: 'white', fontSize: '0.875rem' }}>
            Loading player...
          </div>
        )}
      </div>
      
      {/* Playlist container - hidden */}
      <div 
        ref={playlistRef} 
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default AudioPlayerWrapper;
