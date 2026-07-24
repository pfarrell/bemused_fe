// src/components/ResultRow.jsx
const ResultRow = ({
  imageUrl,
  imageShape = 'square',
  title,
  subtitle,
  onClick,
  onImageError,
  onContextMenu,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  play,
}) => {
  const handlePlayClick = (e) => {
    e.stopPropagation();
    if (!play || play.loading) return;
    play.onPlay();
  };

  return (
    <div
      className="result-row"
      onClick={onClick}
      onContextMenu={onContextMenu}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className={`result-row-image result-row-image-${imageShape}`}>
        <img src={imageUrl} alt={title} onError={onImageError} />
      </div>
      <div className="result-row-text">
        <h3 className="result-row-title">{title}</h3>
        {subtitle && <p className="result-row-subtitle">{subtitle}</p>}
      </div>
      {play && (
        <button
          type="button"
          className="result-row-play"
          data-result-row-play="true"
          onClick={handlePlayClick}
          disabled={play.loading}
          aria-label={play.label}
        >
          {play.loading ? <span className="result-row-play-spinner" /> : '▶'}
        </button>
      )}
    </div>
  );
};

export default ResultRow;
