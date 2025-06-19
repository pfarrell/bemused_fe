// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Search from './pages/Search';
import Artist from './pages/Artist';
import Album from './pages/Album';
import Library from './pages/Library';
import Login from './pages/Login';

function App() {
  const basename = import.meta.env.DEV ? '/' : '/bemused/app';
  return (
    <Router basename={basename}>
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
