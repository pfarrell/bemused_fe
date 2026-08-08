import { useIsMobile } from '../hooks/useIsMobile';
import ResultRow from './ResultRow';

const AlbumStubCard = ({ stub }) => {
  const isMobile = useIsMobile();
  const glyph = <div className="album-stub-card-glyph">▢</div>;

  if (isMobile) {
    return (
      <div className="album-stub-card" data-testid="album-stub-card">
        <ResultRow
          imageShape="square"
          imageContent={glyph}
          title={stub.title}
          subtitle={stub.artist_name || 'Missing from your library'}
        />
      </div>
    );
  }

  return (
    <div className="artist-card album-stub-card" data-testid="album-stub-card">
      <div className="artist-card-image album-stub-card-image">
        {glyph}
      </div>
      <div className="artist-card-title">
        <h3>{stub.title}</h3>
        {stub.artist_name && (
          <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
            {stub.artist_name}
          </p>
        )}
      </div>
    </div>
  );
};

export default AlbumStubCard;
