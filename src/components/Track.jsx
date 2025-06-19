const Track = ({ track, index, trackCount, onClick }) => {
  return (
    <div 
      key={track.id || index}
      className="track-item"
      onClick={() => onClick(track, index)}
      style={{ 
        padding: '1rem',
        borderBottom: index < trackCount - 1 ? '1px solid #e5e7eb' : 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease'
      }}
      onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
    >
      <div className="track-play-button">
        <span style={{ fontSize: '0.75rem' }}>▶</span>
      </div>
      <div className="track-info">
        <h4 className="track-title">
          {String(index + 1).padStart(2, '0')}. {track.title}
        </h4>
      </div>
      {track.duration && (
        <div className="track-duration">({track.duration})</div>
      )}
    </div>
  );
};

export default Track;
