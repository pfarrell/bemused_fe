import { useState } from 'react';
import { isMobileDevice } from '../utils/device';
import WikipediaModal from './WikipediaModal';

const toMobileUrl = (url) => url.replace('en.wikipedia.org', 'en.m.wikipedia.org');

const Wikipedia = ({ summary }) => {
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);

  if(Object.keys(summary).length === 0){
    console.log("empty wikipedia data");
    return null;
  }

  // If summary.summary is empty or doesn't exist, don't render
  if (!summary.summary || summary.summary.trim() === '') {
    return null;
  }

  const href = isMobileDevice() ? toMobileUrl(summary.url) : summary.url;

  return (
    <div>
      <p
        className={`wikipedia-content${expanded ? '' : ' wikipedia-content-truncated'}`}
        style={{ lineHeight: '1.6', color: '#374151', margin: '0 0 1rem 0' }}
      >
        {summary.summary}
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
        >... Continue in wikipedia </a>
      </p>
      <button
        className="wikipedia-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
      {showModal && (
        <WikipediaModal url={href} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
};

export default Wikipedia;
