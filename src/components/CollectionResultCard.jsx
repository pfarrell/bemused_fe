// src/components/CollectionResultCard.jsx
import { formatCount } from '../utils/formatters';
import ResultRow from './ResultRow';
import ContextMenu from './ContextMenu';
import { useContextMenu } from '../hooks/useContextMenu';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuthStore } from '../stores/authStore';
import { useFavoritesStore } from '../stores/favoritesStore';

const CollectionResultCard = ({ collection, onClick, imageUrl }) => {
  const isMobile = useIsMobile();
  const { isAuthenticated } = useAuthStore();
  const isFavorite = useFavoritesStore((s) => s.isFavorite('collection', collection.id));
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const ctxMenu = useContextMenu({ shouldIgnore: () => !isAuthenticated });

  const handleImageError = (e) => {
    if (e.target.src.includes('/sm/')) {
      e.target.src = e.target.src.replace('/sm/', '/');
      e.target.onerror = null;
    }
  };

  const handleToggleFavorite = (e) => {
    e.stopPropagation();
    toggleFavorite('collection', collection.id, { id: collection.id, name: collection.name, image_path: collection.image_path, album_count: collection.album_count });
    ctxMenu.close();
  };

  const menu = (
    <ContextMenu
      open={ctxMenu.open}
      position={ctxMenu.position}
      onDismiss={ctxMenu.dismiss}
      onSwallowTouch={ctxMenu.swallowTouch}
      testId="collection-card-menu-backdrop"
    >
      <button onClick={handleToggleFavorite} onTouchEnd={(e) => { e.preventDefault(); handleToggleFavorite(e); }}>
        {isFavorite ? '★ Remove from Favorites' : '☆ Add to Favorites'}
      </button>
    </ContextMenu>
  );

  if (isMobile) {
    const albumCount = formatCount(collection.album_count || null, 'album');
    return (
      <>
        <ResultRow
          imageUrl={imageUrl}
          imageShape="square"
          title={collection.name}
          subtitle={albumCount ? `Collection · ${albumCount}` : 'Collection'}
          onClick={() => !ctxMenu.open && onClick(collection)}
          onImageError={handleImageError}
          onContextMenu={ctxMenu.triggerProps.onContextMenu}
          onTouchStart={ctxMenu.triggerProps.onTouchStart}
          onTouchMove={ctxMenu.triggerProps.onTouchMove}
          onTouchEnd={ctxMenu.triggerProps.onTouchEnd}
        />
        {menu}
      </>
    );
  }

  return (
    <>
      <div className="artist-card" onClick={() => !ctxMenu.open && onClick(collection)} {...ctxMenu.triggerProps}>
        <div className="artist-card-image">
          <img src={imageUrl} alt={collection.name} onError={handleImageError} />
        </div>
        <div className="artist-card-title">
          <h3>{collection.name}</h3>
          {formatCount(collection.album_count || null, 'album') && (
            <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '0.125rem 0 0 0' }}>
              {formatCount(collection.album_count || null, 'album')}
            </p>
          )}
        </div>
      </div>
      {menu}
    </>
  );
};

export default CollectionResultCard;
