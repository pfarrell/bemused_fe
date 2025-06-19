// src/components/player/MusicPlayerWrapper.jsx
import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';

const MusicPlayerWrapper = ({ className = "" }) => {
  const audioRef = useRef();
  const controlsContainerRef = useRef();
  const playlistContainerRef = useRef();
  const playerInstanceRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  
  const {
    setCurrentTrack,
    setIsPlaying,
    setPlayerInstance
  } = usePlayerStore();

  // Load the player script - fixed to prevent redeclaration
  useEffect(() => {
    const loadPlayerScript = () => {
      // Check if script is already loaded AND if AudioPlayer is available
      if (typeof window.AudioPlayer !== 'undefined') {
        console.log('AudioPlayer already available');
        setIsPlayerReady(true);
        return;
      }

      // Check if script tag already exists
      const existingScript = document.querySelector('script[src="/player.js"]');
      if (existingScript) {
        console.log('Script tag exists, waiting for load...');
        existingScript.onload = () => setIsPlayerReady(true);
        return;
      }

      console.log('Loading player script...');
      const script = document.createElement('script');
      script.src = '/player.js';
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
      console.log('Player initialization waiting...', {
        isPlayerReady,
        audioRef: !!audioRef.current,
        controlsRef: !!controlsContainerRef.current,
        playlistRef: !!playlistContainerRef.current
      });
      return;
    }

    try {
      console.log('Initializing AudioPlayer with containers:', {
        audio: audioRef.current,
        controls: controlsContainerRef.current,
        playlist: playlistContainerRef.current
      });

      // Your AudioPlayer expects DOM elements, refs should work fine
      // but let's make sure they're proper DOM elements
      const player = new window.AudioPlayer(
        [], // Start with empty playlist
        audioRef.current,              // Audio element - this is a DOM element
        controlsContainerRef.current,  // Controls container - this is a DOM element  
        playlistContainerRef.current,  // Playlist container - this is a DOM element
        {
          shuffle: false,
          onTrackStart: (track) => {
            console.log('Track started:', track);
            setCurrentTrack(track);
            setIsPlaying(true);
          },
          onFiveSecondMark: (track) => {
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
      console.error('Error details:', error.message);
    }

    return () => {
      if (playerInstanceRef.current) {
        console.log('Cleaning up player instance');
        playerInstanceRef.current = null;
      }
      setPlayerInstance(null);
    };
  }, [isPlayerReady, setCurrentTrack, setIsPlaying, setPlayerInstance]);

  const handleHamburgerClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Toggling playlist. Current state:', showPlaylist);
    console.log('Playlist container element:', playlistContainerRef.current);
    setShowPlaylist(prev => !prev);
  };

  // Debug: Log when showPlaylist changes
  useEffect(() => {
    console.log('Playlist visibility changed to:', showPlaylist);
    if (playlistContainerRef.current) {
      console.log('Playlist container style:', playlistContainerRef.current.style.display);
    }
  }, [showPlaylist]);

  return (
    <div className={`music-player-wrapper ${className}`} style={{ height: '100%' }}>
      {/* Audio element */}
      <audio 
        ref={audioRef} 
        style={{ display: 'none' }}
        preload="metadata"
      />
      
      <div className="flex items-center justify-between w-full h-full px-4">
        {/* Controls container - AudioPlayer renders controls here */}
        <div 
          ref={controlsContainerRef} 
          className="player-controls-container flex-1"
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
        {/* Hamburger button */}
        <button
          onClick={handleHamburgerClick}
          className="playlist-toggle-btn"
          style={{
            background: showPlaylist ? 'rgba(59, 130, 246, 0.8)' : 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: 'white',
            padding: '0.5rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1.2rem',
            minWidth: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            marginLeft: '1rem'
          }}
          title={showPlaylist ? 'Hide Playlist' : 'Show Playlist'}
        >
          ☰
        </button>
        
      </div>
      
      {/* Playlist container - AudioPlayer renders playlist here */}
      <div 
        ref={playlistContainerRef}
        className="music-player-playlist-container"
        style={{
          display: showPlaylist ? 'block' : 'none',
          position: 'fixed',
          top: '5.7em',
          left: '0',
          width: '400px',
          height: 'calc(100vh - 11.4em)',
          backgroundColor: '#2c3e50',
          borderRight: '1px solid #34495e',
          overflow: 'auto',
          zIndex: 1000,
          padding: '1rem',
          color: 'white'
        }}
      >
      </div>
      
      {/* Backdrop to close playlist when clicking outside */}
      {showPlaylist && (
        <div
          style={{
            position: 'fixed',
            top: '5.7em',
            left: '400px',
            right: '0',
            bottom: '5.7em',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 999
          }}
          onClick={() => setShowPlaylist(false)}
        />
      )}
    </div>
  );
};

export default MusicPlayerWrapper;
