// src/components/Track.jsx
import { useState } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { formatDuration } from '../utils/formatters';
import { useNavigate } from 'react-router-dom';

const Track = ({ track, index, trackCount, includeMeta = false, isPlaying = false }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const { playerInstance } = usePlayerStore();
  const navigate = useNavigate();

  const handleTrackClick = () => {
    if (playerInstance) {
      console.log('Playing track now (replacing playlist):', track.title);
      // Clear playlist and play this track immediately
      playerInstance.clearPlaylist();
      playerInstance.addTrack(track);
      playerInstance.loadAndPlayTrack(0);
    }
  };

  const handlePlayNow = () => {
    if (playerInstance) {
      console.log('Playing track now:', track.title);
      playerInstance.clearPlaylist();
      playerInstance.addTrack(track);
      playerInstance.loadAndPlayTrack(0);
    }
    setShowDropdown(false);
  };

  const handlePlayNext = () => {
    if (playerInstance) {
      console.log('Adding track to play next:', track.title);
      playerInstance.addTracks([track], true); // true = play next
      
      // If nothing is playing, start playing immediately
      if (playerInstance.audioPlayer.paused) {
        const currentIndex = playerInstance.currentTrackIndex || 0;
        playerInstance.loadAndPlayTrack(currentIndex);
      }
    }
    setShowDropdown(false);
  };

  const handleAddToQueue = () => {
    if (playerInstance) {
      console.log('Adding track to queue:', track.title);
      playerInstance.addTrack(track);
      
      // If nothing is playing, start playing immediately
      if (playerInstance.audiopPlayer.paused) {
        // Get the current playlist length from the store instead
        const { playlist } = usePlayerStore.getState();
        const trackIndex = playlist.length; // The track we just added
        playerInstance.loadAndPlayTrack(trackIndex);
      }
    }
    setShowDropdown(false);
  };

  return (
    <div 
      key={track.id || index}
      className={`track-item ${isPlaying ? 'currently-playing' : ''}`}
      style={{ 
        padding: '1rem',
        borderBottom: index < trackCount - 1 ? '1px solid #e5e7eb' : 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        backgroundColor: isPlaying ? '#dbeafe' : 'transparent',
        borderLeft: isPlaying ? '4px solid #3b82f6' : '4px solid transparent',
        position: 'relative'
      }}
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
          {String(index + 1).padStart(2, '0')}. {track.title} - {track.artist.name}
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
              <a key={track.album.id} href="#" onClick={(e) => { 
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
              <a key={track.artist.id} href="#" onClick={(e) => { 
                e.stopPropagation(); 
                if (track.artist.id) {
                  navigate(`/artist/${track.artist.id}`);
                } else {
                  console.log('Go to artist:', track.artist.id); 
                }
              }}>
                {track.artist.name}
              </a>
              </>
            )}
          </p>

        </h4>
      </div>

      {/* Ellipsis menu */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          className="track-ellipsis"
          onClick={(e) => {
            e.stopPropagation();
            setShowDropdown(!showDropdown);
          }}
        >
          ⋯
        </button>

        {showDropdown && (
          <>
            {/* Backdrop to close dropdown */}
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 10
              }}
              onClick={() => setShowDropdown(false)}
            />
            
            {/* Dropdown menu */}
            <div className="track-dropdown">
              <button onClick={handlePlayNow}>
                ▶ Play Now
              </button>
              
              <button onClick={handlePlayNext}>
                ⏭ Play Next
              </button>
              
              <button onClick={handleAddToQueue}>
                ➕ Add to Queue
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Track;
