// src/components/SearchBar.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SearchBar = ({ onSearch, className = "" }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (onSearch) {
      onSearch(query);
    } else {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className={`${className}`}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for songs, artists, or albums"
        className="w-full px-4 py-2 rounded border-0 focus:outline-none focus:ring-2 focus:ring-blue-400"
        style={{ backgroundColor: 'white' }}
      />
    </form>
  );
};

export default SearchBar;
