// src/pages/Admin.jsx
import { useNavigate } from 'react-router-dom';

const cardStyle = {
  backgroundColor: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: '6px',
  padding: '1.25rem',
  marginBottom: '1.5rem',
};

const buttonStyle = {
  width: '100%',
  padding: '0.625rem 1rem',
  backgroundColor: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontSize: '0.875rem',
  fontWeight: '500',
  cursor: 'pointer',
};

const Admin = () => {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '1.5rem' }}>Admin</h1>

      <div style={cardStyle}>
        <button onClick={() => navigate('/admin/upload')} style={buttonStyle}>Upload</button>
      </div>
      <div style={cardStyle}>
        <button onClick={() => navigate('/admin/new')} style={buttonStyle}>New</button>
      </div>
      <div style={cardStyle}>
        <button onClick={() => navigate('/admin/logs')} style={buttonStyle}>Logs</button>
      </div>
      <div style={cardStyle}>
        <button onClick={() => navigate('/admin/errors')} style={buttonStyle}>Errors</button>
      </div>
    </div>
  );
};

export default Admin;
