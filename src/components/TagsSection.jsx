import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';

const TagsSection = ({ entityType, entityId, isLoggedIn }) => {
  const [tags, setTags] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [allTags, setAllTags] = useState(null);
  const [loading, setLoading] = useState(false);
  const suggestionsRef = useRef(null);

  const fetchTags = async () => {
    try {
      const fn = entityType === 'album' ? apiService.getAlbumTags : apiService.getArtistTags;
      const res = await fn(entityId);
      setTags(res.data);
    } catch (err) {
      console.error('Failed to load tags', err);
    }
  };

  useEffect(() => {
    fetchTags();
  }, [entityId, entityType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleClick = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleInputFocus = async () => {
    if (allTags === null) {
      try {
        const res = await apiService.getTags();
        setAllTags(res.data);
        if (inputValue.trim()) {
          setSuggestions(res.data.filter(t => t.name.includes(inputValue)).slice(0, 8));
        }
      } catch (err) {
        console.error('Failed to load tag suggestions', err);
      }
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    if (allTags && val.trim()) {
      setSuggestions(allTags.filter(t => t.name.includes(val.toLowerCase())).slice(0, 8));
    } else {
      setSuggestions([]);
    }
  };

  const handleAdd = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const fn = entityType === 'album' ? apiService.addTagToAlbum : apiService.addTagToArtist;
      await fn(entityId, trimmed);
      await fetchTags();
      setInputValue('');
      setSuggestions([]);
    } catch (err) {
      console.error('Failed to add tag', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (tagName) => {
    setLoading(true);
    try {
      const fn = entityType === 'album' ? apiService.removeTagFromAlbum : apiService.removeTagFromArtist;
      await fn(entityId, tagName);
      await fetchTags();
    } catch (err) {
      console.error('Failed to remove tag', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd(inputValue);
    }
    if (e.key === 'Escape') {
      setSuggestions([]);
    }
  };

  if (!isLoggedIn && tags.length === 0) return null;

  return (
    <div style={{
      marginTop: '2rem',
      padding: '1rem',
      backgroundColor: 'var(--color-bg-surface)',
      borderRadius: '8px',
      border: '1px solid var(--color-border)'
    }}>
      <div style={{
        fontSize: '0.75rem',
        fontWeight: '600',
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.75rem'
      }}>
        Tags
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        {tags.map(tag => (
          <span key={tag.id} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            backgroundColor: 'var(--color-border)',
            borderRadius: '12px',
            padding: '3px 10px',
            fontSize: '0.8rem'
          }}>
            <Link
              to={`/tags/${tag.name}`}
              style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}
            >
              #{tag.name}
            </Link>
            {isLoggedIn && (
              <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleRemove(tag.name); }}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-faint)',
                  cursor: 'pointer',
                  padding: '0 0 0 3px',
                  fontSize: '0.75rem',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            )}
          </span>
        ))}

        {isLoggedIn && (
          <div style={{ position: 'relative' }} ref={suggestionsRef}>
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onKeyDown={handleKeyDown}
              placeholder="add tag…"
              disabled={loading}
              style={{
                border: 'none',
                borderBottom: '1px solid var(--color-border-strong)',
                background: 'transparent',
                fontSize: '0.8rem',
                color: 'var(--color-text-secondary)',
                padding: '3px 4px',
                outline: 'none',
                width: '90px'
              }}
            />
            {suggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                zIndex: 10,
                minWidth: '130px'
              }}>
                {suggestions.map(s => (
                  <div
                    key={s.id}
                    onMouseDown={(e) => { e.preventDefault(); handleAdd(s.name); }}
                    style={{
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      color: 'var(--color-text-secondary)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-muted)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    #{s.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagsSection;
