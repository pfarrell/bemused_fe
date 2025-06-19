const Wikipedia = ({ summary }) => {
  return (  
    
      <div>
        <p style={{ lineHeight: '1.6', color: '#374151', margin: '0 0 1rem 0' }}>
          {summary.summary || summary}
          <a 
            target="_"
            href={summary.url} 
          >...more at wikipedia </a>
        </p>
      </div>
    
  );
};

export default Wikipedia;
