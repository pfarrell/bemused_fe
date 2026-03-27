// src/components/SearchBar.jsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const SearchBar = ({ onSearch, className = "" }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Blur the input to dismiss the keyboard on mobile
    if (inputRef.current) {
      inputRef.current.blur();
    }

    if (onSearch) {
      onSearch(query);
    } else {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <form onSubmit={handleSearch} style={{ width: '100%' }} className={className}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for songs, artists, or albums"
        className="search-input"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />
    </form>
  );
};

export default SearchBar;
