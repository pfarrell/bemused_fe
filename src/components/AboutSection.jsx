import Wikipedia from './Wikipedia';

const hasWikipediaContent = (summary) =>
  !!summary && Object.keys(summary).length > 0 && !!summary.summary && summary.summary.trim() !== '';

// Promotes the Wikipedia excerpt out of the header's action row and into its
// own content section — it's a fact about the album/artist, not a playback
// control, so it reads better as a labeled "About" block than as an icon
// mixed in with Play Now/Edit/Share. (The Overtone link lives in the
// PlayActionsMenu overflow menu instead — see useOvertoneAction.)
const AboutSection = ({ heading, summary }) => {
  if (!hasWikipediaContent(summary)) return null;

  return (
    <div className="about-section">
      {heading && <h3 className="about-section-heading">{heading}</h3>}
      <Wikipedia summary={summary} />
    </div>
  );
};

export default AboutSection;
