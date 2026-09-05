// src/pages/Artist.jsx
import { Fragment, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { getAlbumYear } from '../utils/formatters';
import { useAuthStore } from '../stores/authStore';
import { usePlayerStore } from '../stores/playerStore';
import AlbumCard from '../components/AlbumCard';
import Track from '../components/Track';
import AboutSection from '../components/AboutSection';
import Loading from '../components/Loading';
import Retry from '../components/Retry';
import TagsSection from '../components/TagsSection';
import PlayActionsMenu from '../components/PlayActionsMenu';
import ContextMenu from '../components/ContextMenu';
import CardGrid from '../components/CardGrid';
import { useContextMenu } from '../hooks/useContextMenu';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useOvertoneAction } from '../hooks/useOvertoneAction';
import { shareLink } from '../utils/shareLink';

const Artist = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isAuthenticated } = useAuthStore();
  const addTracks = usePlayerStore((s) => s.addTracks);
  const clearPlaylist = usePlayerStore((s) => s.clearPlaylist);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const [artistData, setArtistData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAllSimilar, setShowAllSimilar] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [showArtistModal, setShowArtistModal] = useState(false);
  const isFavorite = useFavoritesStore((s) => s.isFavorite('artist', parseInt(id)));
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const ctxMenu = useContextMenu({ shouldIgnore: (e) => !isAuthenticated || e.target.tagName === 'A' || !!e.target.closest('button') });
  const { overflowAction: overtoneAction, modal: overtoneModal } = useOvertoneAction(artistData?.artist?.musicbrainz_id);

  const handleToggleFavorite = () => {
    if (!artistData?.artist) return;
    toggleFavorite('artist', artistData.artist.id, {
      id: artistData.artist.id,
      name: artistData.artist.name,
      image_path: artistData.artist.image_path,
    });
    ctxMenu.close();
  };

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    const fetchArtistData = async () => {
      try {
        setLoading(true);
        const response = await apiService.getArtist(id);
        console.log('Artist API Response:', response.data);
        setArtistData(response.data);
      } catch (error) {
        console.error('Error fetching artist data:', error);
        setError('Failed to load artist');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchArtistData();
    }
  }, [id, refreshKey]);

  const handleAlbumClick = (album) => {
    navigate(`/album/${album.id}`);
  };

  const reload = () => {
    setRefreshKey(refreshKey => refreshKey + 1)
  }


  if (loading) {
    return (
      <Loading message="Loading artist"/>
    );
  }

  if (error || !artistData || !artistData.artist) {
    return (
      <div className="loading-container">
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#ef4444', fontSize: '1.25rem' }}>{error || 'Artist not found'}</p>
          <button 
            onClick={() => navigate('/')}
            style={{ 
              marginTop: '1rem', 
              padding: '0.5rem 1rem', 
              backgroundColor: '#3b82f6', 
              color: 'white', 
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const { artist, summary, albums, singles, appears_on, related_artists, members, member_of, similar_artists } = artistData;

  const handlePlaySingles = () => {
    if (singles?.length) {
      clearPlaylist();
      addTracks(singles);
    }
  };

  return (
    <div style={{ padding: '.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Artist Header */}
      <div className='media-page-header' {...ctxMenu.triggerProps}>
        {/* Artist Image */}
        <div style={{ flexShrink: 0 }}>
          <img
            src={apiService.getImageUrl(artist.image_path, 'artist_page')}
            alt={artist.name}
            className='full-image'
            onClick={() => setShowArtistModal(true)}
            style={{ cursor: 'zoom-in' }}
            onError={(e) => {
              console.log(`Failed to load artist image: ${e.target.src}`);
            }}
          />
        </div>
        {showArtistModal && createPortal(
          <div
            onClick={() => setShowArtistModal(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              backgroundColor: 'rgba(0,0,0,0.85)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              cursor: 'zoom-out', padding: '1rem',
            }}
          >
            <img
              src={apiService.getImageUrl(artist.image_path, 'artist_page')}
              alt={artist.name}
              style={{
                maxWidth: '90vw', maxHeight: '80vh',
                objectFit: 'contain', borderRadius: '4px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}
            />
            <div style={{ marginTop: '0.75rem', textAlign: 'center', color: 'white' }}>
              <div style={{ fontWeight: '600', fontSize: '1rem' }}>{artist.name}</div>
            </div>
          </div>,
          document.body
        )}
        
        {/* Artist Info */}
        <div style={{ flex: 1 }}>
          <div className="artist-header-title-row" style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0, color: '#1f2937', cursor: 'pointer' }}
              onClick={ reload }
            >
              {artist.name}
            </h1>

            <div className="artist-header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
              <PlayActionsMenu
                overflowActions={[
                  isAdmin && { key: 'edit', icon: '✎', label: 'Edit', onClick: () => navigate(`/admin/artist/${id}`) },
                  isAuthenticated && {
                    key: 'favorite',
                    icon: isFavorite ? '★' : '☆',
                    label: isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
                    onClick: handleToggleFavorite,
                  },
                  overtoneAction,
                  { key: 'share', icon: '📤', label: 'Share', onClick: () => shareLink({ title: artist.name, text: artist.name }) },
                ].filter(Boolean)}
              />
              {overtoneModal}
            </div>
          </div>

          <AboutSection
            heading="About this artist"
            summary={summary}
          />

          {member_of && member_of.length > 0 && (
            <p style={{ fontSize: '0.95rem', margin: '0.5rem 0 0 0', color: '#6b7280' }}>
              Member of:{' '}
              {member_of.map((g, i) => (
                <span key={g.id}>
                  {i > 0 && ' · '}
                  <span
                    style={{ color: '#3b82f6', cursor: 'pointer' }}
                    onClick={() => navigate(`/artist/${g.id}`)}
                  >
                    {g.name}
                  </span>
                </span>
              ))}
            </p>
          )}

          {members && members.length > 0 && (
            <p style={{ fontSize: '0.95rem', margin: '0.5rem 0 0 0', color: '#6b7280' }}>
              Members:{' '}
              {members.map((m, i) => (
                <span key={m.id}>
                  {i > 0 && ' · '}
                  <span
                    style={{ color: '#3b82f6', cursor: 'pointer' }}
                    onClick={() => navigate(`/artist/${m.id}`)}
                  >
                    {m.name}
                  </span>
                </span>
              ))}
            </p>
          )}

          {related_artists && related_artists.length > 0 && (
            <p style={{ fontSize: '0.95rem', margin: '0.5rem 0 0 0', color: '#6b7280' }}>
              Related artists:{' '}
              {related_artists.map((ra, i) => (
                <span key={ra.id}>
                  {i > 0 && ' · '}
                  <span
                    style={{ color: '#3b82f6', cursor: 'pointer' }}
                    onClick={() => navigate(`/artist/${ra.id}`)}
                  >
                    {ra.name}
                  </span>
                </span>
              ))}
            </p>
          )}

          {similar_artists && similar_artists.length > 0 && (() => {
            const cap = isMobile ? 3 : 10;
            const expandedCap = 25;
            const displayed = showAllSimilar
              ? similar_artists.slice(0, expandedCap)
              : similar_artists.slice(0, cap);
            const hasMore = !showAllSimilar && similar_artists.length > cap;
            return (
              <p style={{ fontSize: '0.95rem', margin: '0.5rem 0 0 0', color: '#6b7280' }}>
                Similar artists:{' '}
                {displayed.map((sa, i) => (
                  <span key={sa.id}>
                    {i > 0 && ' · '}
                    {sa.has_tracks ? (
                      <span
                        style={{ color: '#3b82f6', cursor: 'pointer' }}
                        onClick={() => navigate(`/artist/${sa.id}`)}
                      >
                        {sa.name}
                      </span>
                    ) : (
                      <span>{sa.name}</span>
                    )}
                  </span>
                ))}
                {hasMore && !showAllSimilar && (
                  <span
                    style={{ color: '#3b82f6', cursor: 'pointer', marginLeft: '0.5rem' }}
                    onClick={() => setShowAllSimilar(true)}
                  >
                    {' '}+{Math.min(similar_artists.length, expandedCap) - cap} more
                  </span>
                )}
                {showAllSimilar && (
                  <span
                    style={{ color: '#3b82f6', cursor: 'pointer', marginLeft: '0.5rem' }}
                    onClick={() => setShowAllSimilar(false)}
                  >
                    {' '}show less
                  </span>
                )}
              </p>
            );
          })()}

        </div>
      </div>

      <ContextMenu
        open={ctxMenu.open}
        position={ctxMenu.position}
        onDismiss={ctxMenu.dismiss}
        onSwallowTouch={ctxMenu.swallowTouch}
        testId="artist-header-menu-backdrop"
      >
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleFavorite(); }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleFavorite(); }}
        >
          {isFavorite ? '★ Remove from Favorites' : '☆ Add to Favorites'}
        </button>
      </ContextMenu>

      {/* Albums Grid */}
      {albums && albums.length > 0 && (
        <div className="artist-grid">
          <CardGrid>
            {albums.map((album, i) => {
              const imageUrl = apiService.getImageUrl(album.image_path, 'album_small')
              const showDivider = i > 0 && !!getAlbumYear(albums[i - 1].release_year) && !getAlbumYear(album.release_year)
              return (
                <Fragment key={album.id}>
                  {showDivider && <div className="album-year-divider" />}
                  <AlbumCard
                    album={album}
                    artist={album.artist}
                    imageUrl={imageUrl}
                    onClick={handleAlbumClick}
                    hideArtist={album.artist?.id === artist.id}
                  />
                </Fragment>
              )
            })}
          </CardGrid>
        </div>
      )}

      {/* Singles */}
      {singles && singles.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>
              Singles
            </h2>
            <button
              className="play-oval-toggle"
              onClick={handlePlaySingles}
              style={{ fontSize: '0.875rem' }}
            >
              ▶ Play All
            </button>
          </div>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            overflowX: 'hidden',
          }}>
            {singles.map((track, index) => (
              <Track
                key={track.id}
                track={track}
                index={index}
                trackCount={singles.length}
                isPlaying={currentTrack?.id === track.id}
                showEdit={isAdmin}
              />
            ))}
          </div>
        </div>
      )}

      {/* Appears On */}
      {appears_on && appears_on.length > 0 && (
        <div className="artist-grid">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '1.5rem 0 0.75rem 0', color: '#1f2937' }}>
            Appears On
          </h2>
          <CardGrid>
            {appears_on.map((album) => {
              const imageUrl = apiService.getImageUrl(album.image_path, 'album_small')
              return (
                <AlbumCard
                  key={`appears-${album.id}`}
                  album={album}
                  artist={album.artist}
                  imageUrl={imageUrl}
                  onClick={handleAlbumClick}
                />
              )
            })}
          </CardGrid>
        </div>
      )}

      <TagsSection entityType="artist" entityId={parseInt(id)} isLoggedIn={isAuthenticated} />
    </div>
  );
};

export default Artist;
