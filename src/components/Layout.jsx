// src/components/Layout.jsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import SearchBar from './SearchBar';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isAdmin, logout } = useAuthStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const mainContentRef = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const pullStartY = useRef(0);

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

  // Pull-to-refresh functionality for mobile
  useEffect(() => {
    const mainContent = mainContentRef.current;
    if (!mainContent) return;

    let touchStartY = 0;
    let touchStartScrollTop = 0;

    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
      touchStartScrollTop = mainContent.scrollTop;
      pullStartY.current = touchStartY;
    };

    const handleTouchMove = (e) => {
      const currentScrollTop = mainContent.scrollTop;
      const touchY = e.touches[0].clientY;
      const pullDist = touchY - pullStartY.current;

      // Only activate if we're at the top and pulling down
      if (currentScrollTop <= 0 && touchStartScrollTop <= 0 && pullDist > 0) {
        if (pullDist <= 100) {
          setIsPulling(true);
          setPullDistance(pullDist);
          // Prevent default scrolling when pulling
          if (pullDist > 5) {
            e.preventDefault();
          }
        }
      } else {
        setIsPulling(false);
        setPullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (isPulling && pullDistance > 60) {
        // Trigger refresh
        window.location.reload();
      }
      setIsPulling(false);
      setPullDistance(0);
    };

    mainContent.addEventListener('touchstart', handleTouchStart, { passive: true });
    mainContent.addEventListener('touchmove', handleTouchMove, { passive: false });
    mainContent.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      mainContent.removeEventListener('touchstart', handleTouchStart);
      mainContent.removeEventListener('touchmove', handleTouchMove);
      mainContent.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPulling, pullDistance]);

  const handleLogout = async () => {
    await logout();
    setShowDropdown(false);
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
              {/* Username on desktop (only when logged in) */}
              {isAuthenticated && user && (
                <span className="username-desktop">{user.username}</span>
              )}
              {/* Login button on desktop (only when logged out) */}
              {!isAuthenticated && (
                <span className="login-desktop" style={{
                  border: '1px solid currentColor',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.25rem'
                }}>
                  Login
                </span>
              )}
              {/* Hamburger icon on mobile (always) */}
              <svg className="hamburger-mobile" style={{ width: '1.5rem', height: '1.5rem', display: 'none' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              {/* Chevron on desktop (only when logged in) */}
              {isAuthenticated && user && (
                <svg className="chevron-desktop" style={{ width: '1rem', height: '1rem' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
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
                {isAuthenticated && user ? (
                  <>
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #3a4853' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{user.username}</div>
                    </div>

                    <div style={{ padding: '0.5rem 0' }}>
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          navigate('/');
                        }}
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
                        Home
                      </button>
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          navigate('/playlists');
                        }}
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
                        Playlists
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => {
                              setShowDropdown(false);
                              navigate('/admin/upload');
                            }}
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
                            Upload
                          </button>
                          <button
                            onClick={() => {
                              setShowDropdown(false);
                              navigate('/admin/logs');
                            }}
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
                            Logs
                          </button>
                        </>
                      )}
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
                  </>
                ) : (
                  <div style={{ padding: '0.5rem 0' }}>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        navigate('/login', { state: { from: location.pathname + location.search } });
                      }}
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
                      Login
                    </button>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        navigate('/signup');
                      }}
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
                      Sign Up
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - This is where page content gets rendered */}
      <div className="main-content" ref={mainContentRef} style={{ position: 'relative' }}>
        {/* Pull-to-refresh indicator */}
        {isPulling && (
          <div style={{
            position: 'absolute',
            top: `-${60 - pullDistance}px`,
            left: 0,
            right: 0,
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: isPulling ? 'none' : 'top 0.3s ease-out',
            zIndex: 999,
            pointerEvents: 'none'
          }}>
            <div style={{
              color: '#3b82f6',
              fontSize: '1.5rem',
              transform: `rotate(${pullDistance * 3.6}deg)`,
              transition: 'transform 0.1s'
            }}>
              ↻
            </div>
          </div>
        )}
        <div style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out'
        }}>
          {children}
        </div>
      </div>

    </div>
  );
};

export default Layout;
