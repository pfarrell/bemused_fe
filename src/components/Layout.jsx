// src/components/Layout.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from './SearchBar';
import MusicPlayerWrapper from './player/MusicPlayerWrapper';

const Layout = ({ children }) => {
  const navigate = useNavigate();

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
          
          <div className="user-menu">
            <span></span>
            <svg style={{ marginLeft: '0.25rem', width: '1rem', height: '1rem' }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Content - This is where page content gets rendered */}
      <div className="main-content">
        {children}
      </div>

      {/* Fixed Footer */}
      <div className="app-footer">
        <MusicPlayerWrapper />
      </div>
    </div>
  );
};

export default Layout;
