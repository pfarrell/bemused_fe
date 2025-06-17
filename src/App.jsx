// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';
import Login from './pages/Login';
import AudioPlayerWrapper from './components/player/AudioPlayerWrapper';

function App() {
  return (
    <Router>
      <div className="app min-h-screen flex flex-col">
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/library" element={<Library />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>
        
        {/* Fixed player at bottom */}
        <div className="player-section border-t bg-white">
          <AudioPlayerWrapper />
        </div>
      </div>
    </Router>
  );
}

export default App;
