// src/components/player/MusicPlayerWrapper.jsx
import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { apiService } from '../../services/api';

const MusicPlayerWrapper = ({ className = "" }) => {
  const audioRef = useRef();
  const controlsContainerRef = useRef();
  const playlistContainerRef = useRef();
  const playerInstanceRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  
  const {
    setCurrentTrack,
    setIsPlaying,
    setPlayerInstance
  } = usePlayerStore();

  // Load the player script
  useEffect(() => {
    const loadPlayerScript = () => {
      if (typeof window.AudioPlayer !== 'undefined') {
        console.log('AudioPlayer already available');
        setIsPlayerReady(true);
        return;
      }

      // Determine script path based on environment
      const scriptPath = import.meta.env.DEV
        ? '/player.js'  // Dev server will serve from public/
        : '/bemused/frontend/player.js';  // Production path

      const existingScript = document.querySelector(`script[src="${scriptPath}"]`);
      if (existingScript) {
        console.log('Script tag exists, waiting for load...');
        existingScript.onload = () => setIsPlayerReady(true);
        return;
      }

      console.log('Loading player script...');
      const script = document.createElement('script');
      script.src = scriptPath;
      script.onload = () => {
        console.log('Player script loaded successfully');
        setIsPlayerReady(true);
      };
      script.onerror = () => {
        console.error('Failed to load music player script');
      };
      document.head.appendChild(script);
    };

    loadPlayerScript();
  }, []);

  // Initialize the player when ready
  useEffect(() => {
    if (!isPlayerReady || !audioRef.current || !controlsContainerRef.current || !playlistContainerRef.current) {
      return;
    }

    try {
      console.log('Initializing AudioPlayer...');

      const player = new window.AudioPlayer(
        [], // Start with empty playlist
        audioRef.current,              // Audio element
        controlsContainerRef.current,  // Controls container (player will render hamburger + controls here)
        playlistContainerRef.current,  // Playlist container (player will manage visibility)
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
            return '';
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
        playerInstanceRef.current = null;
      }
      setPlayerInstance(null);
    };
  }, [isPlayerReady, setCurrentTrack, setIsPlaying, setPlayerInstance]);

  return (
    <div className={`music-player-wrapper ${className}`}>
      {/* Audio element - hidden */}
      <audio 
        ref={audioRef} 
        style={{ display: 'none' }}
        preload="metadata"
      />
      
      {/* Controls container - AudioPlayer renders hamburger + all controls here */}
      <div 
        ref={controlsContainerRef} 
        className="player-controls-container"
      >
        {!isPlayerReady && (
          <div className="loading-text">
            Loading player...
          </div>
        )}
      </div>
      
      {/* Playlist container - AudioPlayer manages this visibility via hamburger */}
      <div 
        ref={playlistContainerRef}
        className="music-player-playlist-container"
      />
    </div>
  );
};

export default MusicPlayerWrapper;
