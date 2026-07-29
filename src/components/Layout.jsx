// src/components/Layout.jsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useHomeModeStore } from '../stores/homeModeStore';
import { useTagFilterStore } from '../stores/tagFilterStore';
import { useHomeFeedStore } from '../stores/homeFeedStore';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';
import SearchBar from './SearchBar';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isAdmin, logout } = useAuthStore();
  const { mode, setMode } = useHomeModeStore();
  const { activeTag, setTag, clearTag } = useTagFilterStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [allTagsCache, setAllTagsCache] = useState(null);
  const dropdownRef = useRef(null);
  const mainContentRef = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
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

  // Fetch tags for autocomplete when hamburger opens
  useEffect(() => {
    if (showDropdown && allTagsCache === null) {
      apiService.getTags().then(res => setAllTagsCache(res.data)).catch(() => {});
    }
  }, [showDropdown]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // Remount the current page to re-fetch data without reloading the app
        useHomeFeedStore.getState().invalidate();
        setRefreshKey(k => k + 1);
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

  // Shared by the "P·Share" logo and both "Home" menu buttons: always
  // forces a fresh random feed and a remount, even if already on '/'
  // (where navigate('/') alone would be a no-op).
  const goHome = () => {
    useHomeFeedStore.getState().invalidate();
    setRefreshKey(k => k + 1);
    setShowDropdown(false);
    navigate('/');
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#3a4853' }}>
      {/* Fixed Header */}
      <div className="app-header">
        <div className="header-content">
          <h1 className="app-logo" onClick={goHome} style={{ cursor: 'pointer' }}>
            P·Share
          </h1>
          
          <div className="header-search">
            <SearchBar />
          </div>

          {activeTag && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              background: '#3b82f6',
              color: 'white',
              padding: '2px 10px',
              borderRadius: '10px',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap'
            }}>
              <Link to={`/tags/${activeTag}`} style={{ color: 'white', textDecoration: 'none' }}>
                #{activeTag}
              </Link>
              <span
                onClick={clearTag}
                style={{ cursor: 'pointer', marginLeft: '2px', opacity: 0.8 }}
              >
                ×
              </span>
            </span>
          )}

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
              {/* Hamburger icon on mobile (always) */}
              <svg className="hamburger-mobile" style={{ width: '1.5rem', height: '1.5rem' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
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
                {isAuthenticated && user ? (
                  <>
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #3a4853' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{user.username}</div>
                    </div>
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #3a4853' }}>
                      <div style={{ color: '#9ca3af', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        Home View
                      </div>
                      <div style={{ display: 'inline-flex', background: '#1a252f', borderRadius: '20px', padding: '3px' }}>
                        <button
                          onClick={() => { setMode('artists'); setShowDropdown(false); }}
                          style={{
                            background: mode === 'artists' ? '#3b82f6' : 'none',
                            color: mode === 'artists' ? 'white' : '#9ca3af',
                            padding: '4px 14px', borderRadius: '18px',
                            fontSize: '0.75rem', fontWeight: '600',
                            border: 'none', cursor: 'pointer',
                          }}
                        >
                          Artists
                        </button>
                        <button
                          onClick={() => { setMode('albums'); setShowDropdown(false); }}
                          style={{
                            background: mode === 'albums' ? '#3b82f6' : 'none',
                            color: mode === 'albums' ? 'white' : '#9ca3af',
                            padding: '4px 14px', borderRadius: '18px',
                            fontSize: '0.75rem', fontWeight: '600',
                            border: 'none', cursor: 'pointer',
                          }}
                        >
                          Albums
                        </button>
                      </div>
                    </div>

                    {/* Tag Filter — logged-in */}
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #3a4853' }}>
                      <div style={{ color: '#9ca3af', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        Tag Filter
                      </div>
                      {activeTag ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.8rem', color: '#3b82f6' }}>#{activeTag}</span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={async () => {
                                try {
                                  await apiService.setDefaultTag(activeTag);
                                  toast.success(`Default tag set to #${activeTag}`);
                                } catch {
                                  toast.error('Failed to save default tag');
                                }
                              }}
                              style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}
                            >
                              set default
                            </button>
                            <button
                              onClick={() => { clearTag(); setShowDropdown(false); }}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}
                            >
                              clear
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => {
                              setTagInput(e.target.value);
                              if (allTagsCache) {
                                setTagSuggestions(
                                  allTagsCache.filter(t => t.name.includes(e.target.value.toLowerCase())).slice(0, 6)
                                );
                              }
                            }}
                            placeholder="filter by tag…"
                            style={{
                              width: '100%',
                              padding: '4px 6px',
                              background: '#1a252f',
                              border: '1px solid #374151',
                              borderRadius: '4px',
                              color: '#e2e8f0',
                              fontSize: '0.8rem',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && tagInput.trim()) {
                                setTag(tagInput.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
                                setTagInput('');
                                setTagSuggestions([]);
                                setShowDropdown(false);
                              }
                            }}
                          />
                          {tagSuggestions.length > 0 && (
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              backgroundColor: '#1a252f',
                              border: '1px solid #374151',
                              borderRadius: '4px',
                              zIndex: 60
                            }}>
                              {tagSuggestions.map(t => (
                                <div
                                  key={t.id}
                                  onClick={() => {
                                    setTag(t.name);
                                    setTagInput('');
                                    setTagSuggestions([]);
                                    setShowDropdown(false);
                                  }}
                                  style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '0.8rem', color: '#e2e8f0' }}
                                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a3540'}
                                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  #{t.name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ padding: '0.5rem 0' }}>
                      <button
                        onClick={goHome}
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
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          navigate('/collections');
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
                        Collections
                      </button>
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          navigate('/account');
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
                        Account
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
                              navigate('/admin/new');
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
                            New
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
                  <div>
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #3a4853' }}>
                      <div style={{ color: '#9ca3af', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        Home View
                      </div>
                      <div style={{ display: 'inline-flex', background: '#1a252f', borderRadius: '20px', padding: '3px' }}>
                        <button
                          onClick={() => { setMode('artists'); setShowDropdown(false); }}
                          style={{
                            background: mode === 'artists' ? '#3b82f6' : 'none',
                            color: mode === 'artists' ? 'white' : '#9ca3af',
                            padding: '4px 14px', borderRadius: '18px',
                            fontSize: '0.75rem', fontWeight: '600',
                            border: 'none', cursor: 'pointer',
                          }}
                        >
                          Artists
                        </button>
                        <button
                          onClick={() => { setMode('albums'); setShowDropdown(false); }}
                          style={{
                            background: mode === 'albums' ? '#3b82f6' : 'none',
                            color: mode === 'albums' ? 'white' : '#9ca3af',
                            padding: '4px 14px', borderRadius: '18px',
                            fontSize: '0.75rem', fontWeight: '600',
                            border: 'none', cursor: 'pointer',
                          }}
                        >
                          Albums
                        </button>
                      </div>
                    </div>
                    {/* Tag Filter — logged-out */}
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #3a4853' }}>
                      <div style={{ color: '#9ca3af', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        Tag Filter
                      </div>
                      {activeTag ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.8rem', color: '#3b82f6' }}>#{activeTag}</span>
                          <button
                            onClick={() => { clearTag(); setShowDropdown(false); }}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}
                          >
                            clear
                          </button>
                        </div>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => {
                              setTagInput(e.target.value);
                              if (allTagsCache) {
                                setTagSuggestions(
                                  allTagsCache.filter(t => t.name.includes(e.target.value.toLowerCase())).slice(0, 6)
                                );
                              }
                            }}
                            placeholder="filter by tag…"
                            style={{
                              width: '100%',
                              padding: '4px 6px',
                              background: '#1a252f',
                              border: '1px solid #374151',
                              borderRadius: '4px',
                              color: '#e2e8f0',
                              fontSize: '0.8rem',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && tagInput.trim()) {
                                setTag(tagInput.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
                                setTagInput('');
                                setTagSuggestions([]);
                                setShowDropdown(false);
                              }
                            }}
                          />
                          {tagSuggestions.length > 0 && (
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              backgroundColor: '#1a252f',
                              border: '1px solid #374151',
                              borderRadius: '4px',
                              zIndex: 60
                            }}>
                              {tagSuggestions.map(t => (
                                <div
                                  key={t.id}
                                  onClick={() => {
                                    setTag(t.name);
                                    setTagInput('');
                                    setTagSuggestions([]);
                                    setShowDropdown(false);
                                  }}
                                  style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '0.8rem', color: '#e2e8f0' }}
                                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a3540'}
                                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  #{t.name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ padding: '0.5rem 0' }}>
                      <button
                        onClick={goHome}
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
                        Login / Sign Up
                      </button>
                    </div>
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
        <div key={refreshKey} style={{
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
