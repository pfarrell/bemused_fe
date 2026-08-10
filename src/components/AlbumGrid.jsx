import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import AlbumCard from './AlbumCard';
import CardGrid from './CardGrid';

const AlbumGrid = ({ albums, gridRef, sentinelRef }) => {
  const navigate = useNavigate();

  return (
    <div className="artist-grid">
      <CardGrid ref={gridRef}>
        {albums.map((album) => (
          <AlbumCard key={album.id} album={album} artist={album.artist}
            imageUrl={apiService.getImageUrl(album.image_path, 'album_small')}
            onClick={(a) => navigate(`/album/${a.id}`)} />
        ))}
      </CardGrid>
      {sentinelRef && <div ref={sentinelRef} style={{ height: '1px' }} />}
    </div>
  );
};

export default AlbumGrid;
