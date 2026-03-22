// src/components/Layout.jsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import SearchBar from './SearchBar';
import MusicPlayerWrapper from './player/MusicPlayerWrapper';
import NowPlaying from './NowPlaying';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleLogout = async () => {
    await logout();
    setShowDropdown(false);
    navigate('/login');
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#3a4853' }}>
      {/* Fixed Header */}
      <div className="app-header">
        <div className="header-content">
          <h1 className="app-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            P·Share
          </h1>
          
          <div className="header-search">
            <SearchBar />
          </div>

          {isAuthenticated && user ? (
            <div className="user-menu" ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  fontSize: '0.9rem'
                }}
              >
                <span>{user.username}</span>
                {user.admin && <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>(admin)</span>}
                <svg style={{ width: '1rem', height: '1rem' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {showDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  backgroundColor: '#2a3540',
                  borderRadius: '0.375rem',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                  minWidth: '12rem',
                  zIndex: 50
                }}>
                  <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #3a4853' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{user.username}</div>
                    {user.email && <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.25rem' }}>{user.email}</div>}
                  </div>

                  <div style={{ padding: '0.5rem 0' }}>
                    <button
                      onClick={handleLogout}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.5rem 1rem',
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#3a4853'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="user-menu">
              <button
                onClick={() => navigate('/login')}
                style={{
                  background: 'none',
                  border: '1px solid currentColor',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.9rem'
                }}
              >
                Login
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - This is where page content gets rendered */}
      <div className="main-content">
        {children}
      </div>

      {/* Fixed Footer */}
      <div className="app-footer">
        <NowPlaying />
        <MusicPlayerWrapper />
      </div>
    </div>
  );
};

export default Layout;
