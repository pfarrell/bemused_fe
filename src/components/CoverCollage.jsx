// src/components/CoverCollage.jsx
import { apiService } from '../services/api';
import { handleSmallImageError } from '../utils/imageFallback';

// Fills 100% of its parent — callers own sizing/positioning (fixed box,
// percentage-square grid card, etc), matching how a plain <img> was used
// in each of those call sites before this was extracted.
export default function CoverCollage({
  imagePath,
  items = [],
  alt,
  onImageClick,
  placeholderGlyph = '▣',
  imageContext = 'album_page',
}) {
  if (imagePath) {
    return (
      <img
        src={apiService.getImageUrl(imagePath, imageContext)}
        alt={alt}
        onClick={onImageClick}
        onError={handleSmallImageError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          cursor: onImageClick ? 'zoom-in' : undefined,
        }}
      />
    );
  }

  const itemsWithImages = (items || []).filter((item) => item.image_path);

  if (itemsWithImages.length >= 4) {
    return (
      <div
        data-testid="cover-collage"
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
        }}
      >
        {itemsWithImages.slice(0, 4).map((item) => (
          <img
            key={item.id}
            src={apiService.getImageUrl(item.image_path, 'album_small')}
            alt=""
            onError={handleSmallImageError}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ))}
      </div>
    );
  }

  if (itemsWithImages.length >= 1) {
    return (
      <img
        data-testid="cover-collage-single"
        src={apiService.getImageUrl(itemsWithImages[0].image_path, 'album_small')}
        alt={alt}
        onError={handleSmallImageError}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }

  return (
    <div
      data-testid="cover-collage-placeholder"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '4rem',
        color: 'var(--color-text-faint)',
      }}
    >
      {placeholderGlyph}
    </div>
  );
}
