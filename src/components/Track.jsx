// src/components/Track.jsx
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePlayerStore } from '../stores/playerStore';
import { formatDuration } from '../utils/formatters';
import { useNavigate } from 'react-router-dom';
import AddToPlaylistModal from './AddToPlaylistModal';

const Track = ({ track, index, trackCount, includeMeta = false, isPlaying = false }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ x: 0, y: 0 });
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const { playerInstance } = usePlayerStore();
  const navigate = useNavigate();
  const longPressTimer = useRef(null);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const trackItemRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleTrackClick = () => {
    if (playerInstance) {
      console.log('Playing track now (replacing playlist):', track.title);
      // Clear playlist and play this track immediately
      playerInstance.clearPlaylist();
      playerInstance.addTrack(track);
      playerInstance.loadAndPlayTrack(0);
    }
  };

  const handlePlayNow = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (playerInstance) {
      console.log('Playing track now:', track.title);
      playerInstance.clearPlaylist();
      playerInstance.addTrack(track);
      playerInstance.loadAndPlayTrack(0);
    }
    // Use timeout to ensure state updates properly
    setTimeout(() => setShowDropdown(false), 0);
  };

  const handlePlayNext = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (playerInstance) {
      console.log('Adding track to play next:', track.title);
      playerInstance.addTracks([track], true); // true = play next

      // If nothing is playing, start playing immediately
      if (playerInstance.audioPlayer.paused) {
        const currentIndex = playerInstance.currentTrackIndex || 0;
        playerInstance.loadAndPlayTrack(currentIndex);
      }
    }
    setTimeout(() => setShowDropdown(false), 0);
  };

  const handleAddToQueue = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (playerInstance) {
      console.log('Adding track to queue:', track.title);
      playerInstance.addTrack(track);

      // If nothing is playing, start playing immediately
      if (playerInstance.audioPlayer && playerInstance.audioPlayer.paused) {
        // Get the current playlist length from the store instead
        const { playlist } = usePlayerStore.getState();
        const trackIndex = playlist.length - 1; // The track we just added
        playerInstance.loadAndPlayTrack(trackIndex);
      }
    }
    setTimeout(() => setShowDropdown(false), 0);
  };

  const handleAddToPlaylist = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setShowDropdown(false);
    setShowPlaylistModal(true);
  };

  // Long-press handlers
  const handleTouchStart = (e) => {
    // Don't trigger long-press on links or if dropdown is already open
    if (e.target.tagName === 'A' || showDropdown) {
      return;
    }

    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };

    longPressTimer.current = setTimeout(() => {
      // Set dropdown position at touch location for mobile
      if (isMobile) {
        const menuWidth = 200;
        const menuHeight = 150;

        let x = touchStartPos.current.x;
        let y = touchStartPos.current.y;

        // Center the menu horizontally around touch point
        x = x - menuWidth / 2;

        // Keep menu on screen
        if (x < 10) x = 10;
        if (x + menuWidth > window.innerWidth) {
          x = window.innerWidth - menuWidth - 10;
        }

        if (y + menuHeight > window.innerHeight) {
          y = y - menuHeight - 10;
        }

        if (y < 10) y = 10;

        setDropdownPos({ x, y });
      }
      setShowDropdown(true);
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500); // 500ms long-press duration
  };

  const handleTouchMove = (e) => {
    // Cancel long-press if finger moves too much
    const moveThreshold = 10; // pixels
    const deltaX = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const deltaY = Math.abs(e.touches[0].clientY - touchStartPos.current.y);

    if (deltaX > moveThreshold || deltaY > moveThreshold) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // If dropdown is showing, don't trigger normal click behavior
    if (showDropdown) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Right-click handler for desktop
  const handleContextMenu = (e) => {
    // Don't show context menu on links
    if (e.target.tagName === 'A') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Calculate position - adjust to avoid going off screen
    const menuHeight = 120; // Approximate height of 3-button menu
    const menuWidth = 140;

    // Use raw viewport coordinates (clientX/clientY work with position: fixed)
    let x = e.clientX;
    let y = e.clientY;

    // Keep menu on screen horizontally
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }

    // Keep menu on screen vertically
    if (y + menuHeight > window.innerHeight) {
      y = Math.max(10, e.clientY - menuHeight);
    }

    setDropdownPos({ x, y });
    setShowDropdown(true);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  return (
    <div
      ref={trackItemRef}
      className={`track-item ${isPlaying ? 'currently-playing' : ''}`}
      style={{
        padding: '1rem',
        borderBottom: index < trackCount - 1 ? '1px solid #e5e7eb' : 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        backgroundColor: isPlaying ? '#dbeafe' : 'transparent',
        borderLeft: isPlaying ? '4px solid #3b82f6' : '4px solid transparent',
        position: 'relative',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      onMouseEnter={(e) => {
        if (!isPlaying) {
          e.currentTarget.style.backgroundColor = '#f9fafb';
        }
      }}
      onMouseLeave={(e) => {
        if (!isPlaying) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <div className="track-play-button" onClick={handleTrackClick}>
        <span style={{ fontSize: '0.75rem' }}>
          {isPlaying ? '♪' : '▶'}
        </span>
      </div>
      
      <div className="track-info" onClick={handleTrackClick} style={{ flex: 1, minWidth: 0 }}>
        <h4 className="track-title" style={{ 
          fontWeight: isPlaying ? '600' : '500',
          color: isPlaying ? '#1d4ed8' : '#1f2937'
        }}>
          {String(index + 1).padStart(2, '0')}. {track.title} 
          {track.artist.name != track.album.artist.name && (' - ' + track.artist.name)}
           
          {track.duration && (
            <span style={{ 
              color: '#6b7280', 
              fontWeight: 'normal',
              marginLeft: '0.5rem'
            }}>
              ({formatDuration(track.duration)})
            </span>
          )}
          <p className="track-artist-album">
            {includeMeta && track.album && (
              <>
              {' '} 
              from
              <a onClick={(e) => { 
                e.stopPropagation(); 
                if (track.album.id) {
                  navigate(`/album/${track.album.id}`);
                } else {
                  console.log('Go to album:', track.album); 
                }
              }}>
                {track.album.title}
              </a>
              {' by'} 
              <a onClick={(e) => { 
                e.stopPropagation(); 
                if (track.album.artist.id) {
                  navigate(`/artist/${track.album.artist.id}`);
                } else {
                  console.log('Go to artist:', track.album.artist.id); 
                }
              }}>
              {track.album.artist.name}
              </a>
              </>
            )}
          </p>

        </h4>
      </div>

      {/* Dropdown menu - shown by right-click on desktop or long-press on mobile */}
      {showDropdown && createPortal(
        <>
          {/* Backdrop to close dropdown */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 50
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDropdown(false);
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDropdown(false);
            }}
          />

          {/* Dropdown menu */}
          <div
            className="track-dropdown"
            style={{
              position: 'fixed',
              left: `${dropdownPos.x}px`,
              top: `${dropdownPos.y}px`,
              transform: 'none',
              zIndex: 100
            }}
          >
            <button
              onClick={handlePlayNow}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePlayNow();
              }}
            >
              ▶ Play Now
            </button>

            <button
              onClick={handlePlayNext}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePlayNext();
              }}
            >
              ⏭ Play Next
            </button>

            <button
              onClick={handleAddToQueue}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAddToQueue();
              }}
            >
              ➕ Add to Queue
            </button>

            <button
              onClick={handleAddToPlaylist}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAddToPlaylist();
              }}
            >
              📋 Add to Playlist
            </button>
          </div>
        </>,
        document.body
      )}

      {/* Add to Playlist Modal */}
      {showPlaylistModal && (
        <AddToPlaylistModal
          track={track}
          onClose={() => setShowPlaylistModal(false)}
        />
      )}
    </div>
  );
};

export default Track;
