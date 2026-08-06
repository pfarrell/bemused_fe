// src/components/Track.jsx
import { useState } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { apiService } from '../services/api';
import { formatDuration } from '../utils/formatters';
import { useNavigate } from 'react-router-dom';
import { useContextMenu } from '../hooks/useContextMenu';
import { useIsMobile } from '../hooks/useIsMobile';
import { useIsCurrentPage } from '../hooks/useIsCurrentPage';
import ContextMenu from './ContextMenu';
import AddToPlaylistModal from './AddToPlaylistModal';
import TrackNotesModal from './TrackNotesModal';

const Track = ({ track, index, trackCount, includeMeta = false, isPlaying = false, showMakeSingle = false, onMadeSingle }) => {
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [pressedButton, setPressedButton] = useState(null);
  const playlist = usePlayerStore((s) => s.playlist);
  const addTrack = usePlayerStore((s) => s.addTrack);
  const addTracks = usePlayerStore((s) => s.addTracks);
  const clearPlaylist = usePlayerStore((s) => s.clearPlaylist);
  const playTrackAtIndex = usePlayerStore((s) => s.playTrackAtIndex);
  const { isAuthenticated } = useAuthStore();
  const isFavorite = useFavoritesStore((s) => s.isFavorite('track', track.id));
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const downloadsEnabled = import.meta.env.VITE_ENABLE_DOWNLOADS !== 'false';
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const ctxMenu = useContextMenu({ shouldIgnore: (e) => e.target.tagName === 'A' });

  const onThisAlbum = useIsCurrentPage(track.album?.id ? `/album/${track.album.id}` : null);
  const onThisArtist = useIsCurrentPage(track.artist?.id ? `/artist/${track.artist.id}` : null);

  const handleTrackClick = () => {
    const existingIndex = playlist.findIndex((t) => t.id === track.id);
    if (existingIndex !== -1) {
      playTrackAtIndex(existingIndex);
    } else {
      clearPlaylist();
      addTrack(track);
    }
  };

  const handlePlayNow = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const existingIndex = playlist.findIndex((t) => t.id === track.id);
    if (existingIndex !== -1) {
      playTrackAtIndex(existingIndex);
    } else {
      clearPlaylist();
      addTrack(track);
    }
    setTimeout(() => ctxMenu.close(), 0);
  };

  const handlePlayNext = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    addTracks([track], true, { flashActivity: true }); // true = play next; store auto-starts playback if idle
    setPressedButton('next');
    setTimeout(() => {
      ctxMenu.close();
      setPressedButton(null);
    }, 220);
  };

  const handleAddToQueue = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    addTrack(track, { flashActivity: true }); // store auto-starts playback if idle
    setPressedButton('queue');
    setTimeout(() => {
      ctxMenu.close();
      setPressedButton(null);
    }, 220);
  };

  const handleGoToAlbum = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    navigate(`/album/${track.album.id}`);
    ctxMenu.close();
  };

  const handleGoToArtist = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    navigate(`/artist/${track.artist.id}`);
    ctxMenu.close();
  };

  const handleMakeSingle = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!window.confirm(`Remove "${track.title}" from this album and register it as a single for ${track.artist?.name || 'this artist'}?`)) {
      return;
    }
    try {
      await apiService.makeTrackSingle(track.id);
      ctxMenu.close();
      onMadeSingle?.(track.id);
    } catch (error) {
      alert('Failed to make track a single: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAddToPlaylist = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    ctxMenu.close();
    setShowPlaylistModal(true);
  };

  const handleShowNotes = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    ctxMenu.close();
    setShowNotesModal(true);
  };

  const handleToggleFavorite = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    toggleFavorite('track', track.id, {
      id: track.id,
      title: track.title,
      track_number: track.track_number,
      duration: track.duration,
      artist: track.artist,
      album: track.album,
      download_url: track.download_url,
    });
    ctxMenu.close();
  };

  const handleDownload = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    window.location.href = track.download_url;
    ctxMenu.close();
  };

  return (
    <div
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
      {...ctxMenu.triggerProps}
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
          {track.artist.id !== track.album?.artist?.id && (' - ' + track.artist.name)}

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
              {track.album.title !== '_Singles' && (
                <>
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
                {' '}
                </>
              )}
              by
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

      <ContextMenu
        open={ctxMenu.open}
        position={ctxMenu.position}
        openedViaTouch={ctxMenu.openedViaTouch}
        onDismiss={ctxMenu.dismiss}
        onSwallowTouch={ctxMenu.swallowTouch}
        testId="track-menu-backdrop"
      >
        <button
          onClick={handlePlayNow}
          onTouchStart={(e) => { e.stopPropagation(); }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handlePlayNow(); }}
        >
          ▶ Play Now
        </button>

        <button
          className={pressedButton === 'next' ? 'menu-btn-pressed' : ''}
          onClick={handlePlayNext}
          onTouchStart={(e) => { e.stopPropagation(); }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handlePlayNext(); }}
        >
          ⏭ Play Next
        </button>

        <button
          className={pressedButton === 'queue' ? 'menu-btn-pressed' : ''}
          onClick={handleAddToQueue}
          onTouchStart={(e) => { e.stopPropagation(); }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleAddToQueue(); }}
        >
          ➕ Add to Queue
        </button>

        {track.album?.id && !onThisAlbum && (
          <button
            onClick={handleGoToAlbum}
            onTouchStart={(e) => { e.stopPropagation(); }}
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleGoToAlbum(); }}
          >
            💿 Go to Album
          </button>
        )}

        {track.artist?.id && !onThisArtist && (
          <button
            onClick={handleGoToArtist}
            onTouchStart={(e) => { e.stopPropagation(); }}
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleGoToArtist(); }}
          >
            🎤 Go to Artist
          </button>
        )}

        {showMakeSingle && track.album?.id && track.album.title !== '_Singles' && (
          <button
            onClick={handleMakeSingle}
            onTouchStart={(e) => { e.stopPropagation(); }}
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleMakeSingle(); }}
          >
            🎵 Make Single
          </button>
        )}

        <button
          onClick={handleAddToPlaylist}
          onTouchStart={(e) => { e.stopPropagation(); }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleAddToPlaylist(); }}
        >
          📋 Add to Playlist
        </button>

        <button
          onClick={handleShowNotes}
          onTouchStart={(e) => { e.stopPropagation(); }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleShowNotes(); }}
        >
          📝 Notes
        </button>

        {isAuthenticated && (
          <button
            onClick={handleToggleFavorite}
            onTouchStart={(e) => { e.stopPropagation(); }}
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleFavorite(); }}
          >
            {isFavorite ? '★ Remove from Favorites' : '☆ Add to Favorites'}
          </button>
        )}

        {downloadsEnabled && isAuthenticated && track.download_url && !isMobile && (
          <button
            onClick={handleDownload}
            onTouchStart={(e) => { e.stopPropagation(); }}
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleDownload(); }}
          >
            ⬇ Download
          </button>
        )}
      </ContextMenu>

      {showPlaylistModal && (
        <AddToPlaylistModal
          track={track}
          onClose={() => setShowPlaylistModal(false)}
        />
      )}

      {showNotesModal && (
        <TrackNotesModal
          track={track}
          onClose={() => setShowNotesModal(false)}
        />
      )}
    </div>
  );
};

export default Track;
