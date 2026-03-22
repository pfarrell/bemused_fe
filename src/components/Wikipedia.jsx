const Wikipedia = ({ summary }) => {

  if(Object.keys(summary).length === 0){
    console.log("empty wikipedia data");
    return null;
  }

  // If summary.summary is empty or doesn't exist, don't render
  if (!summary.summary || summary.summary.trim() === '') {
    return null;
  }

  return (
    <div>
      <p style={{ lineHeight: '1.6', color: '#374151', margin: '0 0 1rem 0' }}>
        {summary.summary}
        <a
          target="_blank"
          rel="noopener noreferrer"
          href={summary.url}
        >...more at wikipedia </a>
      </p>
    </div>
  );
};

export default Wikipedia;
