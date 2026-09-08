import { useState } from 'react';
import { isMobileDevice } from '../utils/device';
import WikipediaModal from './WikipediaModal';

const toMobileUrl = (url) => url.replace('en.wikipedia.org', 'en.m.wikipedia.org');

const MOBILE_SUMMARY_CHAR_LIMIT = 220;

// Word-boundary truncation, not -webkit-line-clamp: line-clamp hides the
// pill's true position, forcing the "more" link to be pinned to a corner
// instead of trailing the text like it does on desktop.
const truncateSummary = (text, limit) => {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

const Wikipedia = ({ summary }) => {
  const [showModal, setShowModal] = useState(false);

  if(Object.keys(summary).length === 0){
    console.log("empty wikipedia data");
    return null;
  }

  // If summary.summary is empty or doesn't exist, don't render
  if (!summary.summary || summary.summary.trim() === '') {
    return null;
  }

  const mobile = isMobileDevice();
  const href = mobile ? toMobileUrl(summary.url) : summary.url;
  const displayedSummary = mobile
    ? truncateSummary(summary.summary, MOBILE_SUMMARY_CHAR_LIMIT)
    : summary.summary;

  return (
    <div>
      <p
        className="wikipedia-content"
        style={{ lineHeight: '1.6', color: 'var(--color-text-secondary)', margin: '0 0 1rem 0' }}
      >
        {displayedSummary}
        <a
          target="_blank"
          rel="noopener noreferrer"
          href={href}
          onClick={(e) => {
            // A modified click (ctrl/cmd/shift, middle-click) is the
            // user asking for a real new tab — let the browser do that.
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            setShowModal(true);
          }}
        > more</a>
      </p>
      {showModal && (
        <WikipediaModal url={href} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
};

export default Wikipedia;
