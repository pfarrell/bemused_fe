const Loading = ({message}) => {
  return ( 
    <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '4em',
        minHeight: '100%',
        backgroundColor: '#3a4853'
      }}>
    <div>
      <div className="loading-spinner"></div>
      <p className="loading-text">{message}...</p>
    </div>
    </div>
  );
};

export default Loading


