 const Retry = ({error}) => {
   return (
     <div className="loading-container">
       <div style={{ textAlign: 'center' }}>
         <p style={{ color: '#ef4444', fontSize: '1.25rem' }}>{error}</p>
         <button 
           onClick={() => window.location.reload()}
           style={{ 
             marginTop: '1rem', 
             padding: '0.5rem 1rem', 
             backgroundColor: '#3b82f6', 
             color: 'white', 
             borderRadius: '4px',
             border: 'none',
             cursor: 'pointer'
           }}
         >
           Retry
         </button>
       </div>
      </div>
   );
 };

export default Retry;
