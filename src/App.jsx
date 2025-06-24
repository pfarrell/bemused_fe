// 1. SCROLL TO TOP FIX
// Add this to your src/App.jsx file

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Search from './pages/Search';
import Artist from './pages/Artist';
import Album from './pages/Album';
import Library from './pages/Library';
import Login from './pages/Login';

// Add this component to handle scroll to top on route changes
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top when route changes
    window.scrollTo(0, 0);
    
    // Also scroll the main content container if it exists
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}

function App() {
  const basename = import.meta.env.DEV ? '/' : '/bemused/app';
  
  useEffect(() => {
    // 2. FULLSCREEN/PWA SETUP FOR MOBILE
    const setupMobileFullscreen = () => {
      // Add PWA meta tags if not already present
      const addMetaTag = (name, content) => {
        if (!document.querySelector(`meta[name="${name}"]`)) {
          const meta = document.createElement('meta');
          meta.name = name;
          meta.content = content;
          document.head.appendChild(meta);
        }
      };

      // PWA meta tags for fullscreen experience
      addMetaTag('apple-mobile-web-app-capable', 'yes');
      addMetaTag('apple-mobile-web-app-status-bar-style', 'black-translucent');
      addMetaTag('mobile-web-app-capable', 'yes');
      addMetaTag('theme-color', '#1a252f');
      
      // Viewport meta tag for better mobile experience
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
      }

      // Prevent iOS Safari from showing address bar when scrolling
      const preventBounce = (e) => {
        if (e.target === document.body) {
          e.preventDefault();
        }
      };
      
      document.addEventListener('touchmove', preventBounce, { passive: false });
      
      // Hide address bar on iOS
      const hideAddressBar = () => {
        if (window.navigator.standalone !== true) {
          setTimeout(() => {
            window.scrollTo(0, 1);
            setTimeout(() => window.scrollTo(0, 0), 0);
          }, 1000);
        }
      };
      
      window.addEventListener('load', hideAddressBar);
      window.addEventListener('orientationchange', hideAddressBar);
      
      return () => {
        document.removeEventListener('touchmove', preventBounce);
        window.removeEventListener('load', hideAddressBar);
        window.removeEventListener('orientationchange', hideAddressBar);
      };
    };

    const cleanup = setupMobileFullscreen();
    return cleanup;
  }, []);

  return (
    <Router basename={basename}>
      <ScrollToTop /> {/* Add the ScrollToTop component here */}
      <div className="app h-screen overflow-hidden">
        <Routes>
          {/* Login page without layout */}
          <Route path="/login" element={<Login />} />
          
          {/* All other pages use the shared layout */}
          <Route path="/*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/search" element={<Search />} />
                <Route path="/artist/:id" element={<Artist />} />
                <Route path="/album/:id" element={<Album />} />
                <Route path="/library" element={<Library />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
