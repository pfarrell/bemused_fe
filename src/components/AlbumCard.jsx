import { useState } from 'react';
import { createPortal } from 'react-dom';

const AlbumCard = ({ album, artist, onClick, imageUrl, fullImageUrl }) => {
  const [showModal, setShowModal] = useState(false);

  const handleImageClick = (e) => {
    e.stopPropagation();
    if (fullImageUrl) setShowModal(true);
  };

  return (
    <>
      <div
         key={album.id}
         className="artist-card"
         onClick={() => onClick(album)}
      >
        <div className="artist-card-image">
          <img
            src={imageUrl}
            alt={`${album.title}, ${artist.name}`}
            onClick={handleImageClick}
            style={{ cursor: fullImageUrl ? 'zoom-in' : 'pointer' }}
            onError={(e) => {
              console.log(`Failed to load album image: ${e.target.src}`);
            }}
          />
        </div>
        <div className="artist-card-title">
          <h3>{album.title}</h3>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.25rem 0 0 0', cursor: 'pointer' }}>
            {artist.name}
          </p>
        </div>
      </div>

      {showModal && createPortal(
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', padding: '1rem',
          }}
        >
          <img
            src={fullImageUrl}
            alt={`${album.title}, ${artist.name}`}
            style={{
              maxWidth: '90vw', maxHeight: '80vh',
              objectFit: 'contain', borderRadius: '4px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
            onError={(e) => { e.target.src = imageUrl; }}
          />
          <div style={{ marginTop: '0.75rem', textAlign: 'center', color: 'white' }}>
            <div style={{ fontWeight: '600', fontSize: '1rem' }}>{album.title}</div>
            <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.25rem' }}>{artist.name}</div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default AlbumCard;
