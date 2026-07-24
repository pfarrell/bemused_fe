import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AddToCollectionModal from './AddToCollectionModal';
import ResultRow from './ResultRow';
import { useIsMobile } from '../hooks/useIsMobile';
import { apiService } from '../services/api';
import { usePlayerStore } from '../stores/playerStore';
import { formatCount } from '../utils/formatters';

const AlbumCard = ({ album, artist, onClick, imageUrl, hideArtist = false }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ x: 0, y: 0 });
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [playLoading, setPlayLoading] = useState(false);
  const longPressTimer = useRef(null);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const justOpenedByLongPress = useRef(false);
  const clearLongPressFlagTimer = useRef(null);
  const isMobile = useIsMobile();
  const { clearPlaylist, addTracks } = usePlayerStore();

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (clearLongPressFlagTimer.current) clearTimeout(clearLongPressFlagTimer.current);
    };
  }, []);

  const openDropdown = (x, y) => {
    const menuWidth = 200;
    const menuHeight = 60;
    let px = x;
    let py = y;
    if (px + menuWidth > window.innerWidth) px = window.innerWidth - menuWidth - 10;
    if (px < 10) px = 10;
    if (py + menuHeight > window.innerHeight) py = Math.max(10, y - menuHeight - 10);
    setDropdownPos({ x: px, y: py });
    setShowDropdown(true);
  };

  const handleContextMenu = (e) => {
    if (e.target.closest('[data-result-row-play]')) return;
    e.preventDefault();
    e.stopPropagation();
    openDropdown(e.clientX, e.clientY);
  };

  const handleTouchStart = (e) => {
    if (showDropdown) return;
    if (e.target.closest('[data-result-row-play]')) return;
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    longPressTimer.current = setTimeout(() => {
      const x = isMobile
        ? Math.max(10, touchStartPos.current.x - 100)
        : touchStartPos.current.x;
      justOpenedByLongPress.current = true;
      openDropdown(x, touchStartPos.current.y);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleTouchMove = (e) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    }
  };

  const handleTouchEnd = (e) => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (justOpenedByLongPress.current) {
      e.preventDefault(); e.stopPropagation();
      if (clearLongPressFlagTimer.current) clearTimeout(clearLongPressFlagTimer.current);
      clearLongPressFlagTimer.current = setTimeout(() => { justOpenedByLongPress.current = false; }, 350);
      return;
    }
    if (showDropdown) { e.preventDefault(); e.stopPropagation(); }
  };

  const handleImageError = (e) => {
    if (e.target.src.includes('/sm/')) {
      e.target.src = e.target.src.replace('/sm/', '/');
      e.target.onerror = null;
    }
  };

  const handlePlayAll = async () => {
    setPlayLoading(true);
    try {
      const response = await apiService.getAlbum(album.id);
      clearPlaylist();
      addTracks(response.data.tracks);
    } catch (err) {
      console.error('Failed to play album', err);
    } finally {
      setPlayLoading(false);
    }
  };

  const subtitle = hideArtist
    ? 'Album'
    : `Album · ${artist.name}${album.has_collaborators ? ' +' : ''}`;

  return (
    <>
      {isMobile ? (
        <ResultRow
          imageUrl={imageUrl}
          imageShape="square"
          title={album.title}
          subtitle={subtitle}
          onClick={() => !showDropdown && onClick(album)}
          onImageError={handleImageError}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          play={{ loading: playLoading, onPlay: handlePlayAll, label: `Play ${album.title}` }}
        />
      ) : (
        <div
          className="artist-card"
          onClick={() => !showDropdown && onClick(album)}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="artist-card-image">
            <img
              src={imageUrl}
              alt={`${album.title}, ${artist.name}`}
              style={{ cursor: 'pointer' }}
              onError={handleImageError}
            />
          </div>
          <div className="artist-card-title">
            <h3>{album.title}</h3>
            {!hideArtist && (
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.25rem 0 0 0', cursor: 'pointer' }}>
                {artist.name}{album.has_collaborators && ' +'}
              </p>
            )}
            {formatCount(album.track_count || null, 'track') && (
              <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '0.125rem 0 0 0' }}>
                {formatCount(album.track_count || null, 'track')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Right-click / long-press dropdown */}
      {showDropdown && createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 50 }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (justOpenedByLongPress.current) return; setShowDropdown(false); }}
            onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); if (justOpenedByLongPress.current) return; setShowDropdown(false); }}
          />
          <div style={{
            position: 'fixed',
            left: `${dropdownPos.x}px`,
            top: `${dropdownPos.y}px`,
            zIndex: 100,
            backgroundColor: 'white',
            borderRadius: '6px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            minWidth: '180px',
            overflow: 'hidden',
          }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowDropdown(false); setShowCollectionModal(true); }}
              onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setShowDropdown(false); setShowCollectionModal(true); }}
              style={{
                width: '100%', textAlign: 'left', padding: '0.75rem 1rem',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.875rem', color: '#1f2937',
                minHeight: '44px', display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              ▣ Add to Collection
            </button>
          </div>
        </>,
        document.body
      )}

      {/* Add to collection modal */}
      {showCollectionModal && (
        <AddToCollectionModal
          album={album}
          onClose={() => setShowCollectionModal(false)}
        />
      )}
    </>
  );
};

export default AlbumCard;
