const AlbumCard = ({ album, artist, onClick, imageUrl }) => {
  return (
    <div
       key={album.id}
       className="artist-card"
       onClick={() => onClick(album)}
    >
      <div className="artist-card-image">
        <img
          src={imageUrl}
          alt={`${album.title}, ${artist.name}`}
          onError={(e) => {
            console.log(`Failed to load album image: ${e.target.src}`);
          }}
        />
      </div>
      <div className="artist-card-title">
        <h3>{album.title}</h3>
        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
          {artist.name}
        </p>
      </div>
    </div>
  );
};

export default AlbumCard;
