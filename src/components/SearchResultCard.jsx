// src/components/SearchResultCard.jsx
import AlbumCard from './AlbumCard';
import ArtistCard from './ArtistCard';
import PlaylistResultCard from './PlaylistResultCard';
import CollectionResultCard from './CollectionResultCard';

const TYPE_LABELS = {
  album: 'ALBUM',
  artist: 'ARTIST',
  playlist: 'PLAYLIST',
  collection: 'COLLECTION',
};

const SearchResultCard = ({ type, data, onNavigate, getImageUrl }) => {
  let card;
  if (type === 'album') {
    card = (
      <AlbumCard
        album={data}
        artist={data.artist}
        imageUrl={getImageUrl(data.image_path, 'album_small')}
        onClick={(a) => onNavigate(`/album/${a.id}`)}
      />
    );
  } else if (type === 'artist') {
    card = (
      <ArtistCard
        artist={data}
        imageUrl={getImageUrl(data.image_path, 'artist_search')}
        onClick={(a) => onNavigate(`/artist/${a.id}`)}
      />
    );
  } else if (type === 'playlist') {
    card = (
      <PlaylistResultCard
        playlist={data}
        imageUrl={getImageUrl(data.image_path, 'album_small')}
        onClick={(p) => onNavigate(`/playlist/${p.id}`)}
      />
    );
  } else {
    card = (
      <CollectionResultCard
        collection={data}
        imageUrl={getImageUrl(data.image_path, 'album_small')}
        onClick={(cn) => onNavigate(`/collection/${cn.id}`)}
      />
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {card}
      <span className="search-result-type-badge">{TYPE_LABELS[type]}</span>
    </div>
  );
};

export default SearchResultCard;
