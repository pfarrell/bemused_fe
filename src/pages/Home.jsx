// src/pages/Home.jsx
import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import ArtistGrid from '../components/ArtistGrid';
import SearchBar from '../components/SearchBar';

const Home = () => {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRandomArtists = async () => {
      try {
        setLoading(true);
        const response = await apiService.getRandomArtists(60);
        console.log('API Response:', response.data); // Debug line
        setArtists(response.data);
      } catch (error) {
        console.error('Error fetching random artists:', error);
        setError('Failed to load artists');
      } finally {
        setLoading(false);
      }
    };

    fetchRandomArtists();
  }, []);

  const handleArtistClick = (artist) => {
    console.log('Clicked artist:', artist);
  };

  if (loading) {
    return (
      <div className="home-page flex items-center justify-center min-h-screen" style={{ backgroundColor: '#3a4853' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">Loading artists...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-page flex items-center justify-center min-h-screen" style={{ backgroundColor: '#3a4853' }}>
        <div className="text-center">
          <p className="text-red-400 text-xl">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page min-h-screen" style={{ backgroundColor: '#3a4853' }}>
      {/* Header matching your screenshot exactly */}
      <div 
        className="sticky top-0 z-10 border-b"
        style={{ backgroundColor: '#2c3e50', borderBottomColor: '#34495e' }}
      >
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">P-Share</h1>
            
            <div className="flex-1 max-w-md mx-8">
              <SearchBar />
            </div>
            
            <div className="text-white flex items-center">
              <span>patf</span>
              <svg className="ml-1 w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Artist Grid */}
      <ArtistGrid 
        artists={artists} 
        onArtistClick={handleArtistClick}
        imageContext="artist_search"
      />

      {/* Bottom player bar */}
      <div 
        className="fixed bottom-0 left-0 right-0 h-16 border-t flex items-center px-4"
        style={{ backgroundColor: '#2c3e50', borderTopColor: '#34495e' }}
      >
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center">
            <span className="text-white text-xs">♪</span>
          </div>
          <div className="text-white text-sm">0:00</div>
          <div className="text-white text-sm">0:00</div>
          <button className="text-orange-500 hover:text-orange-400">
            <span className="text-xl">⏮</span>
          </button>
          <button className="text-white hover:text-gray-300">
            <span className="text-2xl">▶</span>
          </button>
          <button className="text-orange-500 hover:text-orange-400">
            <span className="text-xl">⏭</span>
          </button>
          <button className="text-white hover:text-gray-300">
            <span className="text-xl">🔀</span>
          </button>
          <button className="text-white hover:text-gray-300">
            <span className="text-xl">☰</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
