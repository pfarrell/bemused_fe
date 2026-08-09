// src/components/AddToCollectionModal.jsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';

const AddToCollectionModal = ({ album, onClose }) => {
  const { user, isAdmin } = useAuthStore();
  const [collections, setCollections] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(null);

  useEffect(() => { loadCollections(); }, []);

  useEffect(() => {
    if (filterText.trim() === '') {
      setFiltered(collections);
    } else {
      setFiltered(collections.filter(c =>
        c.name && c.name.toLowerCase().includes(filterText.toLowerCase())
      ));
    }
  }, [filterText, collections]);

  const loadCollections = async () => {
    try {
      setLoading(true);
      const response = await apiService.getCollections();
      // Only list collections the current user can actually write to — the
      // backend now rejects adding an album to a collection owned by someone
      // else with a 403, so showing those here would just be a dead end.
      const writable = (response.data || []).filter(
        (c) => isAdmin || (user && c.user_id === user.id)
      );
      const sorted = writable.sort((a, b) =>
        new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
      );
      setCollections(sorted);
      setFiltered(sorted);
    } catch {
      toast.error('Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  const addToCollection = async (collectionId, collectionName) => {
    try {
      await apiService.addAlbumToCollection(collectionId, album.id);
      toast.success(`Added "${album.title}" to "${collectionName}"`);
      onClose();
    } catch (err) {
      // 409 = already in collection (unique constraint)
      if (err.response?.status === 409 || err.response?.data?.error?.includes('unique')) {
        toast.error(`"${album.title}" is already in "${collectionName}"`);
      } else {
        toast.error('Failed to add to collection');
      }
    }
  };

  const handleAdd = async () => {
    if (isCreatingNew) {
      const trimmed = newName.trim();
      if (!trimmed) { toast.error('Please enter a collection name'); return; }

      const existing = collections.find(
        c => c.name && c.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) {
        setShowConfirmation({
          collectionId: existing.id,
          collectionName: existing.name,
          message: `A collection named "${existing.name}" already exists. Add album to it?`
        });
        return;
      }

      try {
        const res = await apiService.createCollection(trimmed);
        await apiService.addAlbumToCollection(res.data.id, album.id);
        toast.success(`Created "${trimmed}" and added "${album.title}"`);
        onClose();
      } catch {
        toast.error('Failed to create collection');
      }
    } else {
      if (!selected) { toast.error('Please select a collection'); return; }
      await addToCollection(selected.id, selected.name);
    }
  };

  if (showConfirmation) {
    return createPortal(
      <div style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem'
      }} onClick={(e) => { if (e.target === e.currentTarget) setShowConfirmation(null); }}>
        <div style={{
          backgroundColor: 'white', borderRadius: '8px', padding: '1.5rem',
          maxWidth: '400px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', color: '#1f2937' }}>Confirm</h3>
          <p style={{ margin: '0 0 1.5rem 0', color: '#4b5563', lineHeight: '1.5' }}>
            {showConfirmation.message}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowConfirmation(null)} style={{
              padding: '0.5rem 1rem', backgroundColor: '#e5e7eb', color: '#374151',
              border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem'
            }}>Cancel</button>
            <button onClick={async () => {
              await addToCollection(showConfirmation.collectionId, showConfirmation.collectionName);
              setShowConfirmation(null);
            }} style={{
              padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white',
              border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem'
            }}>Add to Existing</button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem'
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '8px', padding: '1.5rem',
        maxWidth: '500px', width: '100%', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1f2937' }}>
            {isCreatingNew ? 'Create New Collection' : 'Add to Collection'}
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            {album.title}
          </p>
        </div>

        {isCreatingNew ? (
          <>
            <div style={{ flex: 1, marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#374151', fontWeight: '500' }}>
                Collection Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter collection name"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                style={{
                  width: '100%', padding: '0.5rem',
                  border: '1px solid #d1d5db', borderRadius: '4px',
                  fontSize: '1rem', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => { setIsCreatingNew(false); setNewName(''); setSelected(null); }} style={{
                padding: '0.625rem 1rem', backgroundColor: '#e5e7eb', color: '#374151',
                border: 'none', borderRadius: '4px', cursor: 'pointer',
                fontSize: '0.875rem', minHeight: '44px'
              }}>Back</button>
              <button onClick={handleAdd} style={{
                flex: 1, padding: '0.625rem 1rem', backgroundColor: '#3b82f6', color: 'white',
                border: 'none', borderRadius: '4px', cursor: 'pointer',
                fontSize: '0.875rem', minHeight: '44px'
              }}>Create & Add Album</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter collections..."
                style={{
                  width: '100%', padding: '0.5rem',
                  border: '1px solid #d1d5db', borderRadius: '4px',
                  fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{
              flex: 1, overflowY: 'auto', marginBottom: '1rem',
              border: '1px solid #e5e7eb', borderRadius: '4px',
              minHeight: '200px', maxHeight: '400px'
            }}>
              {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading collections...</div>
              ) : (
                <>
                  <div onClick={() => { setIsCreatingNew(true); setNewName(''); }} style={{
                    padding: '0.75rem 1rem', cursor: 'pointer',
                    borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb',
                    fontWeight: '500', color: '#3b82f6', minHeight: '44px',
                    display: 'flex', alignItems: 'center'
                  }}>
                    + Create New...
                  </div>

                  {filtered.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No collections found</div>
                  ) : (
                    filtered.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setSelected(c)}
                        style={{
                          padding: '0.75rem 1rem', cursor: 'pointer',
                          borderBottom: '1px solid #e5e7eb',
                          backgroundColor: selected?.id === c.id ? '#dbeafe' : 'transparent',
                          minHeight: '44px', display: 'flex', alignItems: 'center'
                        }}
                        onMouseEnter={(e) => { if (selected?.id !== c.id) e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                        onMouseLeave={(e) => { if (selected?.id !== c.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        {c.name || '(Unnamed Collection)'}
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={onClose} style={{
                padding: '0.625rem 1rem', backgroundColor: '#e5e7eb', color: '#374151',
                border: 'none', borderRadius: '4px', cursor: 'pointer',
                fontSize: '0.875rem', minHeight: '44px'
              }}>Cancel</button>
              <button onClick={handleAdd} disabled={!selected} style={{
                flex: 1, padding: '0.625rem 1rem',
                backgroundColor: selected ? '#3b82f6' : '#d1d5db',
                color: 'white', border: 'none', borderRadius: '4px',
                cursor: selected ? 'pointer' : 'not-allowed',
                fontSize: '0.875rem', minHeight: '44px', opacity: selected ? 1 : 0.6
              }}>Add to Collection</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default AddToCollectionModal;
