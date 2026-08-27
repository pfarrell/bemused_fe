import { useState } from 'react';
import { isMobileDevice } from '../utils/device';

const toMobileUrl = (url) => url.replace('en.wikipedia.org', 'en.m.wikipedia.org');

const Wikipedia = ({ summary }) => {
  const [expanded, setExpanded] = useState(false);

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
        >... Continue in wikipedia </a>
      </p>
      <button
        className="wikipedia-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
};

export default Wikipedia;
