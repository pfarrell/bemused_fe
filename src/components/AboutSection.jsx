import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Wikipedia from './Wikipedia';
import OvertoneModal from './OvertoneModal';
import { overtoneUrl } from '../utils/overtoneUrl';

const hasWikipediaContent = (summary) =>
  !!summary && Object.keys(summary).length > 0 && !!summary.summary && summary.summary.trim() !== '';

// Promotes the Wikipedia excerpt and the Overtone (MusicBrainz) link out of
// the header's action row and into their own content section — these are
// facts about the album/artist, not playback controls, so they read better
// as a labeled "About" block than as icons mixed in with Play Now/Edit/Share.
const AboutSection = ({ heading, summary, musicbrainzId, entityType = 'artist' }) => {
  const [showOvertone, setShowOvertone] = useState(false);
  const navigate = useNavigate();

  if (!hasWikipediaContent(summary) && !musicbrainzId) return null;

  const url = musicbrainzId ? overtoneUrl(musicbrainzId, entityType) : null;

  return (
    <div className="about-section">
      {heading && <h3 className="about-section-heading">{heading}</h3>}
      <Wikipedia summary={summary} />
      {musicbrainzId && (
        <a
          href={url}
          onClick={(e) => {
            // A modified click (ctrl/cmd/shift, middle-click) is the
            // user asking for a real new tab — let the browser do that.
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            setShowOvertone(true);
          }}
          rel="noopener noreferrer"
          className="about-section-link"
          title="Overtone Info"
          aria-label="Overtone"
        >
          🔍 Overtone
        </a>
      )}
      {showOvertone && (
        <OvertoneModal
          url={url}
          onClose={() => setShowOvertone(false)}
          onNavigate={navigate}
        />
      )}
    </div>
  );
};

export default AboutSection;
