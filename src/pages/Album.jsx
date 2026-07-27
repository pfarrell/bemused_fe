// src/pages/Album.jsx
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';
import Wikipedia from '../components/Wikipedia';
import Track from '../components/Track';
import TagsSection from '../components/TagsSection';
import NotesSection from '../components/NotesSection';
import CompilationArtistLinks from '../components/CompilationArtistLinks';
import ShareButton from '../components/ShareButton';
import PlayActionsMenu from '../components/PlayActionsMenu';

const Album = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addTracks, clearPlaylist, currentTrack, setPageTracks } = usePlayerStore();
  const { isAdmin, isAuthenticated } = useAuthStore();
  const [albumData, setAlbumData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAlbumModal, setShowAlbumModal] = useState(false);

  useEffect(() => {
    const fetchAlbumData = async () => {
      try {
        setLoading(true);
        const response = await apiService.getAlbum(id);
        console.log('Album API Response:', response.data);
        setAlbumData(response.data);
      } catch (error) {
        console.error('Error fetching album data:', error);
        setError('Failed to load album');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchAlbumData();
    }
  }, [id, refreshKey]);

  useEffect(() => {
    // Lets the footer play button fall back to "Play Now" behavior when the playlist is
    // empty, instead of trying to resume a track that was never loaded.
    setPageTracks(albumData?.tracks || []);
    return () => setPageTracks([]);
  }, [albumData, setPageTracks]);

  const reload = () => {
    setRefreshKey(refreshKey + 1)
  }

  const handlePlayNow = () => {
    if (albumData?.tracks) {
      clearPlaylist();
      addTracks(albumData.tracks);
    }
  };

  const handlePlayNext = () => {
    if (albumData?.tracks) {
      addTracks(albumData.tracks, true, { flashActivity: true }); // store auto-starts playback if idle
    }
  };

  const handleAddToQueue = () => {
    if (albumData?.tracks) {
      addTracks(albumData.tracks, false, { flashActivity: true }); // store auto-starts playback if idle
    }
  };

  // Helper function to check if a track is currently playing
  const isTrackPlaying = (track) => {
    return currentTrack && currentTrack.id === track.id;
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100%',
        backgroundColor: '#3a4853'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading album...</p>
        </div>
      </div>
    );
  }

  if (error || !albumData?.album) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100%',
        backgroundColor: '#3a4853'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#ef4444', fontSize: '1.25rem' }}>{error || 'Album not found'}</p>
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

  const { artist, album, tracks, summary, secondary_artists, compilation_artists, collections, notes } = albumData;

  // Collaborators are folded into the primary artist heading itself
  // ("Elton John, Ray Charles"); every other non-primary role (featured,
  // guest, compilation) stays in the smaller "Also featuring" line below.
  const collaborators = (secondary_artists || []).filter((sa) => sa.role === 'collaborator');
  const featuringArtists = album.is_compilation
    ? (compilation_artists || [])
    : (secondary_artists || []).filter((sa) => sa.role !== 'collaborator');

  return (
    <div style={{ padding: '.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Album Header */}
      <div className='media-page-header'>
        {/* Album Cover */}
        <div style={{ flexShrink: 0 }}>
          <img
            src={apiService.getImageUrl(album.image_path, 'album_page')}
            alt={`${album.title} by ${artist.name}`}
            className='full-image'
            onClick={() => setShowAlbumModal(true)}
            style={{ cursor: 'zoom-in' }}
            onError={(e) => {
              console.log(`Failed to load album image: ${e.target.src}`);
            }}
          />
        </div>
        {showAlbumModal && createPortal(
          <div
            onClick={() => setShowAlbumModal(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              backgroundColor: 'rgba(0,0,0,0.85)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              cursor: 'zoom-out', padding: '1rem',
            }}
          >
            <img
              src={apiService.getImageUrl(album.image_path, 'album_page')}
              alt={`${album.title} by ${artist.name}`}
              style={{
                maxWidth: '90vw', maxHeight: '80vh',
                objectFit: 'contain', borderRadius: '4px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}
            />
            <div style={{ marginTop: '0.75rem', textAlign: 'center', color: 'white' }}>
              <div style={{ fontWeight: '600', fontSize: '1rem' }}>{album.title}</div>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.25rem' }}>{artist.name}</div>
            </div>
          </div>,
          document.body
        )}
        
        {/* Album Info */}
        <div className="album-info" style={{ flex: 1 }}>
          <h1 className="album-header-title" style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#7c3aed', cursor: 'pointer' }}
            onClick = {reload}
          >
            {album.title}
          </h1>

          <h2 className="album-header-artist" style={{ fontSize: '1.5rem', fontWeight: 'normal', margin: '0 0 0.5rem 0', color: '#7c3aed' }}>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate(`/artist/${artist.id}`)}>
              {artist.name}
            </span>
            {collaborators.map((c) => (
              <span key={c.id}>
                {', '}
                <span style={{ cursor: 'pointer' }} onClick={() => navigate(`/artist/${c.id}`)}>
                  {c.name}
                </span>
              </span>
            ))}
          </h2>
          {featuringArtists.length > 0 && (
            <p className="album-header-featuring" style={{ fontSize: '0.95rem', margin: '0 0 1rem 0', color: '#6b7280' }}>
              {album.is_compilation ? 'Featuring:' : 'Also featuring:'}{' '}
              <CompilationArtistLinks
                artists={featuringArtists}
                mobileVisibleCount={album.is_compilation ? 5 : undefined}
              />
            </p>
          )}
          {collections?.length > 0 && (
            <p className="album-header-collections" style={{ fontSize: '0.95rem', margin: '0 0 1rem 0', color: '#6b7280' }}>
              In collections:{' '}
              {collections.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ', '}
                  <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/collection/${c.id}`)}>
                    {c.name}
                  </span>
                </span>
              ))}
            </p>
          )}
          {summary && Object.keys(summary).length > 0 && (
            <div className="album-header-wikipedia">
              <Wikipedia summary={summary} />
            </div>
          )}

          {/* Action Buttons */}
          <div className="album-header-actions" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <PlayActionsMenu
              onPlayNow={handlePlayNow}
              onPlayNext={handlePlayNext}
              onAddToQueue={handleAddToQueue}
            />
            {isAdmin && (
              <button
                onClick={() => navigate(`/admin/album/${id}`)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Edit
              </button>
            )}
            <ShareButton title={album.title} text={`${album.title} by ${artist.name}`} />
          </div>

          {/* Album Description */}
          {album.description && (
            <div className="album-header-description">
              <p style={{ lineHeight: '1.6', color: '#374151', margin: '0 0 1rem 0' }}>
                {album.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Track List */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        overflowX: 'hidden',
        overflowY: 'visible'
      }}>
        {tracks.map((track, index) => (
          <Track
            key={track.id || index}
            track={track}
            index={index}
            trackCount={tracks.length}
            isPlaying={isTrackPlaying(track)}
          />
        ))}
      </div>

      <TagsSection entityType="album" entityId={parseInt(id)} isLoggedIn={isAuthenticated} />
      <NotesSection albumId={parseInt(id)} notes={notes || []} isLoggedIn={isAuthenticated} onChange={reload} />
    </div>
  );
};

export default Album;
