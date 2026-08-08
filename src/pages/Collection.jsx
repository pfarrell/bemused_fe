// src/pages/Collection.jsx
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import AlbumCard from '../components/AlbumCard';
import AlbumStubCard from '../components/AlbumStubCard';
import Loading from '../components/Loading';
import Retry from '../components/Retry';
import NotesSection from '../components/NotesSection';
import Wikipedia from '../components/Wikipedia';
import CoverCollage from '../components/CoverCollage';
import ContextMenu from '../components/ContextMenu';
import { useContextMenu } from '../hooks/useContextMenu';
import { useFavoritesStore } from '../stores/favoritesStore';

export default function Collection() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isAuthenticated } = useAuthStore();
  const [collectionData, setCollectionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const isFavorite = useFavoritesStore((s) => s.isFavorite('collection', parseInt(id)));
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const ctxMenu = useContextMenu({ shouldIgnore: (e) => !isAuthenticated || e.target.tagName === 'A' || !!e.target.closest('button') });

  const handleToggleFavorite = () => {
    if (!collectionData?.collection) return;
    const { collection: c } = collectionData;
    toggleFavorite('collection', c.id, { id: c.id, name: c.name, image_path: c.image_path, album_count: collectionData.albums?.length });
    ctxMenu.close();
  };

  useEffect(() => {
    loadCollection();
  }, [id]);

  const loadCollection = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getCollection(id);
      setCollectionData(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <Retry message={error} onRetry={loadCollection} />;
  if (!collectionData) return <div>Collection not found</div>;

  const { collection, albums, stubs, notes, summary } = collectionData;
  const canEdit = isAdmin || (user && collection.user_id === user.id);

  return (
    <div style={{ padding: '2rem', backgroundColor: '#f3f4f6', minHeight: '100%' }}>
      {/* Collection Header */}
      <div
        style={{
          display: 'flex',
          gap: '2rem',
          marginBottom: '2rem',
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}
        {...ctxMenu.triggerProps}
      >
        {/* Collection Image */}
        <div style={{ flexShrink: 0, width: '200px', height: '200px', borderRadius: '0.5rem', overflow: 'hidden' }}>
          <CoverCollage
            imagePath={collection.image_path}
            items={albums}
            alt={collection.name}
            onImageClick={collection.image_path ? () => setShowImageModal(true) : undefined}
            placeholderGlyph="▣"
            imageContext="album_page"
          />
        </div>

        {/* Collection Info */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>
              {collection.name}
            </h1>
            {canEdit && (
              <button
                onClick={() => navigate(`/admin/collection/${id}`)}
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
            {albums?.length || 0} {albums?.length === 1 ? 'album' : 'albums'}
          </p>

          {summary && Object.keys(summary).length > 0 && (
            <Wikipedia summary={summary} />
          )}
        </div>
      </div>

      <ContextMenu
        open={ctxMenu.open}
        position={ctxMenu.position}
        onDismiss={ctxMenu.dismiss}
        onSwallowTouch={ctxMenu.swallowTouch}
        testId="collection-header-menu-backdrop"
      >
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleFavorite(); }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleFavorite(); }}
        >
          {isFavorite ? '★ Remove from Favorites' : '☆ Add to Favorites'}
        </button>
      </ContextMenu>

      {showImageModal && collection.image_path && createPortal(
        <div
          onClick={() => setShowImageModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', padding: '1rem',
          }}
        >
          <img
            src={apiService.getImageUrl(collection.image_path, 'album_page')}
            alt={collection.name}
            style={{
              maxWidth: '90vw', maxHeight: '80vh',
              objectFit: 'contain', borderRadius: '4px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
          />
          <div style={{ marginTop: '0.75rem', textAlign: 'center', color: 'white' }}>
            <div style={{ fontWeight: '600', fontSize: '1rem' }}>{collection.name}</div>
          </div>
        </div>,
        document.body
      )}

      {/* Albums Grid */}
      {(albums?.length > 0 || stubs?.length > 0) ? (
        <div className="artist-grid">
          <div className="artist-grid-container">
            {[
              ...(albums || []).map((album) => ({ type: 'album', order: album.order ?? 0, data: album })),
              ...(stubs || []).map((stub) => ({ type: 'stub', order: stub.order ?? 0, data: stub })),
            ]
              .sort((a, b) => a.order - b.order)
              .map((item) => item.type === 'album' ? (
                <AlbumCard
                  key={`album-${item.data.id}`}
                  album={item.data}
                  artist={item.data.artist}
                  imageUrl={apiService.getImageUrl(item.data.image_path, 'album_small')}
                  onClick={() => navigate(`/album/${item.data.id}`)}
                />
              ) : (
                <AlbumStubCard key={`stub-${item.data.id}`} stub={item.data} />
              ))}
          </div>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          padding: '2rem',
          textAlign: 'center',
          color: '#6b7280'
        }}>
          This collection is empty
        </div>
      )}

      <NotesSection entityType="collection" entityId={parseInt(id)} notes={notes || []} isLoggedIn={isAuthenticated} onChange={loadCollection} />
    </div>
  );
}
