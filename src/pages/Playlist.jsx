// src/pages/Playlist.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';
import Track from '../components/Track';
import Loading from '../components/Loading';
import Retry from '../components/Retry';

export default function Playlist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { playerInstance, currentTrack } = usePlayerStore();
  const { user, isAdmin } = useAuthStore();
  const [playlistData, setPlaylistData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPlaylist();
  }, [id]);

  const loadPlaylist = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getPlaylist(id);
      setPlaylistData(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAll = () => {
    if (!playerInstance || !playlistData?.tracks?.length) return;
    playerInstance.clearPlaylist();
    playerInstance.addTracks(playlistData.tracks);
    playerInstance.loadAndPlayTrack(0);
  };

  const handleAddToQueue = () => {
    if (!playerInstance || !playlistData?.tracks?.length) return;
    playerInstance.addTracks(playlistData.tracks);
  };

  if (loading) return <Loading />;
  if (error) return <Retry message={error} onRetry={loadPlaylist} />;
  if (!playlistData) return <div>Playlist not found</div>;

  const { playlist, tracks } = playlistData;
  // Show edit button if user is admin OR if user owns the playlist
  const canEdit = isAdmin || (user && playlist.user_id === user.id);

  return (
    <div style={{ padding: '2rem', backgroundColor: '#f3f4f6', minHeight: '100%' }}>
      {/* Playlist Header */}
      <div style={{
        display: 'flex',
        gap: '2rem',
        marginBottom: '2rem',
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
      }}>
        {/* Playlist Image */}
        <div style={{ flexShrink: 0 }}>
          {playlist.image_path ? (
            <img
              src={apiService.getImageUrl(playlist.image_path, 'album_page')}
              alt={playlist.name}
              style={{
                width: '200px',
                height: '200px',
                objectFit: 'cover',
                borderRadius: '0.5rem'
              }}
            />
          ) : (
            <div style={{
              width: '200px',
              height: '200px',
              backgroundColor: '#e5e7eb',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '4rem',
              color: '#9ca3af'
            }}>
              ♪
            </div>
          )}
        </div>

        {/* Playlist Info */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>
              {playlist.name}
            </h1>
            {canEdit && (
              <button
                onClick={() => navigate(`/admin/playlist/${id}`)}
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
          </div>

          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            {tracks?.length || 0} {tracks?.length === 1 ? 'track' : 'tracks'}
          </p>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={handlePlayAll}
              disabled={!tracks?.length}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: tracks?.length ? 'pointer' : 'not-allowed',
                fontSize: '0.875rem',
                fontWeight: '500',
                opacity: tracks?.length ? 1 : 0.5
              }}
            >
              � Play Now
            </button>
            <button
              onClick={handleAddToQueue}
              disabled={!tracks?.length}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: tracks?.length ? 'pointer' : 'not-allowed',
                fontSize: '0.875rem',
                fontWeight: '500',
                opacity: tracks?.length ? 1 : 0.5
              }}
            >
              + Add to Queue
            </button>
          </div>
        </div>
      </div>

      {/* Tracks List */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        {tracks && tracks.length > 0 ? (
          tracks.map((track, index) => (
            <Track
              key={track.id}
              track={track}
              index={index}
              trackCount={tracks.length}
              includeMeta={true}
              isPlaying={currentTrack?.id === track.id}
            />
          ))
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
            This playlist is empty
          </div>
        )}
      </div>
    </div>
  );
}
