// src/components/TagFilterControl.jsx
import { useEffect, useState } from 'react';
import { useTagFilterStore } from '../stores/tagFilterStore';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

// Tag-filter input with autocomplete, shared by both hamburger-menu branches
// and the Account page. Owns its own tag-list cache and input state; fetches
// the tag list once on mount rather than eagerly at the app root, since this
// component is only ever mounted when actually visible (dropdown open, or
// the Account page). `allowSetDefault` gates the "set default" action —
// only meaningful for a signed-in user.
const TagFilterControl = ({ allowSetDefault = false, onSelect }) => {
  const { activeTag, setTag, clearTag } = useTagFilterStore();
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [allTagsCache, setAllTagsCache] = useState(null);

  useEffect(() => {
    apiService.getTags().then((res) => setAllTagsCache(res.data)).catch(() => {});
  }, []);

  const selectTag = (name) => {
    setTag(name);
    setTagInput('');
    setTagSuggestions([]);
    onSelect?.();
  };

  const handleSetDefault = async () => {
    try {
      await apiService.setDefaultTag(activeTag);
      toast.success(`Default tag set to #${activeTag}`);
    } catch {
      toast.error('Failed to save default tag');
    }
  };

  return (
    <div>
      {activeTag ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.8rem', color: '#3b82f6' }}>#{activeTag}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {allowSetDefault && (
              <button
                onClick={handleSetDefault}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}
              >
                set default
              </button>
            )}
            <button
              onClick={() => { clearTag(); onSelect?.(); }}
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
                  allTagsCache.filter((t) => t.name.includes(e.target.value.toLowerCase())).slice(0, 6)
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
                selectTag(tagInput.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
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
              {tagSuggestions.map((t) => (
                <div
                  key={t.id}
                  onClick={() => selectTag(t.name)}
                  style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '0.8rem', color: '#e2e8f0' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a3540'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  #{t.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TagFilterControl;
