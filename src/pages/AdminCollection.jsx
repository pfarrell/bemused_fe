// src/pages/AdminCollection.jsx
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';

const AUTO_SCROLL_EDGE_PX = 60;
const AUTO_SCROLL_SPEED_PX = 12;

// Shows exactly where a dragged album/stub would land, between two rows.
const DropIndicator = () => (
  <div data-testid="drop-indicator" style={{ height: '3px', backgroundColor: '#3b82f6', borderRadius: '2px' }} />
);

export default function AdminCollection() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthStore();
  const [collectionData, setCollectionData] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null); // { type: 'album' | 'stub', id }
  const [dragOverTarget, setDragOverTarget] = useState(null); // { type, id, position: 'before' | 'after' }
  const searchPanelRef = useRef(null);
  const autoScrollFrameRef = useRef(null);
  const autoScrollDirectionRef = useRef(0);

  // Search to add albums
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  // Placeholder stubs
  const [stubs, setStubs] = useState([]);
  const [showStubForm, setShowStubForm] = useState(false);
  const [stubTitle, setStubTitle] = useState('');
  const [stubArtistName, setStubArtistName] = useState('');
  const [resolvingStubId, setResolvingStubId] = useState(null);

  // Image download
  const [imageUrl, setImageUrl] = useState('');
  const [imageName, setImageName] = useState('');
  const [downloadingImage, setDownloadingImage] = useState(false);

  useEffect(() => {
    loadCollection();
  }, [id]);

  useEffect(() => {
    if (loading || !collectionData) return;
    if (!(isAdmin || (user && collectionData.user_id === user.id))) {
      navigate(`/collection/${id}`, { replace: true });
    }
  }, [loading, collectionData, isAdmin, user, id, navigate]);

  // The search/resolve panel renders above the albums list — on a long list,
  // opening it (including via Resolve, deep in the list) would otherwise land
  // far outside the current scroll position with nothing visibly changing.
  useEffect(() => {
    if (showSearch && searchPanelRef.current) {
      searchPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showSearch]);

  // Auto-scrolls the page's scroll container (Layout.jsx's .main-content,
  // not window — this app's whole layout is a fixed-height flex column with
  // its own internal scroll area) while a native drag hovers near its top or
  // bottom edge, so a long list can be reordered past the current viewport.
  useEffect(() => {
    const container = document.querySelector('.main-content');
    if (!container) return undefined;

    const stepAutoScroll = () => {
      if (autoScrollDirectionRef.current !== 0) {
        container.scrollTop += autoScrollDirectionRef.current * AUTO_SCROLL_SPEED_PX;
      }
      autoScrollFrameRef.current = requestAnimationFrame(stepAutoScroll);
    };

    const handleDragOverContainer = (e) => {
      const rect = container.getBoundingClientRect();
      if (e.clientY < rect.top + AUTO_SCROLL_EDGE_PX) {
        autoScrollDirectionRef.current = -1;
      } else if (e.clientY > rect.bottom - AUTO_SCROLL_EDGE_PX) {
        autoScrollDirectionRef.current = 1;
      } else {
        autoScrollDirectionRef.current = 0;
      }
      if (!autoScrollFrameRef.current) {
        autoScrollFrameRef.current = requestAnimationFrame(stepAutoScroll);
      }
    };

    const stopAutoScroll = () => {
      autoScrollDirectionRef.current = 0;
      if (autoScrollFrameRef.current) {
        cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
    };

    container.addEventListener('dragover', handleDragOverContainer);
    container.addEventListener('drop', stopAutoScroll);
    container.addEventListener('dragend', stopAutoScroll);

    return () => {
      container.removeEventListener('dragover', handleDragOverContainer);
      container.removeEventListener('drop', stopAutoScroll);
      container.removeEventListener('dragend', stopAutoScroll);
      stopAutoScroll();
    };
  }, []);

  const loadCollection = async () => {
    try {
      setLoading(true);
      const response = await apiService.getCollection(id);
      setCollectionData(response.data.collection);
      setAlbums(response.data.albums || []);
      setStubs(response.data.stubs || []);
    } catch (err) {
      console.error('Failed to load collection:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const response = await apiService.search(searchQuery);
      setSearchResults((response.data.results || []).filter(r => r.type === 'album').map(r => r.data));
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleAddAlbum = async (album) => {
    if (resolvingStubId) {
      return handleResolveStub(album);
    }
    if (albums.some(a => a.id === album.id)) {
      alert('This album is already in the collection');
      return;
    }
    try {
      await apiService.addAlbumToCollection(id, album.id);
      const maxOrder = Math.max(
        0,
        ...albums.map(a => a.order ?? 0),
        ...stubs.map(s => s.order ?? 0),
      );
      setAlbums([...albums, { ...album, order: maxOrder + 1, artist: album.artist || { id: null, name: album.artist_name || '' } }]);
      setShowSearch(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      console.error('Failed to add album:', err);
      alert('Failed to add album');
    }
  };

  const handleResolveStub = async (album) => {
    try {
      await apiService.resolveStub(id, resolvingStubId, album.id);
      const resolvedStub = stubs.find(s => s.id === resolvingStubId);
      setStubs(stubs.filter(s => s.id !== resolvingStubId));
      setAlbums([...albums, { ...album, order: resolvedStub?.order, artist: album.artist || { id: null, name: album.artist_name || '' } }]);
      setResolvingStubId(null);
      setShowSearch(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      console.error('Failed to resolve stub:', err);
      alert(err.response?.data?.error || 'Failed to resolve placeholder');
    }
  };

  const handleRemoveStub = async (stubId) => {
    if (!confirm('Remove this placeholder?')) return;
    try {
      await apiService.removeStubFromCollection(id, stubId);
      setStubs(stubs.filter(s => s.id !== stubId));
    } catch (err) {
      console.error('Failed to remove stub:', err);
      alert('Failed to remove placeholder');
    }
  };

  const handleAddStub = async () => {
    if (!stubTitle.trim()) return;
    try {
      const response = await apiService.addStubToCollection(id, stubTitle.trim(), stubArtistName.trim());
      setStubs([...stubs, response.data.stub]);
      setShowStubForm(false);
      setStubTitle('');
      setStubArtistName('');
    } catch (err) {
      console.error('Failed to add stub:', err);
      alert('Failed to add placeholder');
    }
  };

  const handleRemoveAlbum = async (albumId) => {
    if (!confirm('Remove this album from the collection?')) return;
    try {
      await apiService.removeAlbumFromCollection(id, albumId);
      setAlbums(albums.filter(a => a.id !== albumId));
    } catch (err) {
      console.error('Failed to remove album:', err);
      alert('Failed to remove album');
    }
  };

  const buildMergedItems = () => [
    ...albums.map((album) => ({ type: 'album', order: album.order ?? 0, data: album })),
    ...stubs.map((stub) => ({ type: 'stub', order: stub.order ?? 0, data: stub })),
  ].sort((a, b) => a.order - b.order);

  const handleDragStart = (e, item) => {
    setDraggedItem({ type: item.type, id: item.data.id });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, item) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const position = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
    setDragOverTarget({ type: item.type, id: item.data.id, position });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const handleDrop = async (e, targetItem) => {
    e.preventDefault();
    const dropPosition = dragOverTarget?.position ?? 'before';
    setDragOverTarget(null);
    if (!draggedItem) return;
    if (draggedItem.type === targetItem.type && draggedItem.id === targetItem.data.id) return;

    const current = buildMergedItems();
    const fromIndex = current.findIndex((i) => i.type === draggedItem.type && i.data.id === draggedItem.id);
    let toIndex = current.findIndex((i) => i.type === targetItem.type && i.data.id === targetItem.data.id);
    if (fromIndex === -1 || toIndex === -1) return;
    if (dropPosition === 'after') toIndex += 1;

    const reordered = [...current];
    const [moved] = reordered.splice(fromIndex, 1);
    // toIndex was computed against the pre-removal array — shift it back by
    // one if the removed item was earlier in the list than the drop target.
    const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex;
    reordered.splice(insertAt, 0, moved);

    const withNewOrder = reordered.map((item, i) => ({ ...item, order: i + 1 }));
    setAlbums(withNewOrder.filter((i) => i.type === 'album').map((i) => ({ ...i.data, order: i.order })));
    setStubs(withNewOrder.filter((i) => i.type === 'stub').map((i) => ({ ...i.data, order: i.order })));
    setDraggedItem(null);

    try {
      const album_orders = withNewOrder.filter((i) => i.type === 'album').map((i) => ({ album_id: i.data.id, order: i.order }));
      const stub_orders = withNewOrder.filter((i) => i.type === 'stub').map((i) => ({ stub_id: i.data.id, order: i.order }));
      await apiService.reorderCollectionAlbums(id, album_orders, stub_orders);
    } catch (err) {
      console.error('Failed to reorder collection:', err);
      alert('Failed to save order');
      loadCollection();
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiService.updateCollection(id, {
        name: collectionData.name,
        image_path: collectionData.image_path,
        wikipedia: collectionData.wikipedia,
      });
      navigate(`/collection/${id}`);
    } catch (err) {
      console.error('Failed to save collection:', err);
      alert('Failed to save collection');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadImage = async (e) => {
    e.preventDefault();
    if (!imageUrl || !imageName) {
      alert('Both Image URL and Image Name are required');
      return;
    }
    setDownloadingImage(true);
    try {
      await apiService.downloadCollectionImage(id, imageUrl, imageName);
      setCollectionData(prev => ({ ...prev, image_path: imageName }));
      setImageUrl('');
      setImageName('');
      await loadCollection();
    } catch (error) {
      console.error('Error downloading image:', error);
      alert(error.response?.data?.error || 'Failed to download image');
    } finally {
      setDownloadingImage(false);
    }
  };

  const canEdit = isAdmin || (user && collectionData?.user_id === user.id);

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;
  if (!canEdit) return null;

  return (
    <div style={{ padding: '2rem', backgroundColor: '#f3f4f6', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>Edit Collection</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => navigate(`/collection/${id}`)}
            style={{
              padding: '0.5rem 1rem', backgroundColor: '#6b7280', color: 'white',
              border: 'none', borderRadius: '4px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white',
              border: 'none', borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div style={{
        backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem',
        marginBottom: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Collection Name
          </label>
          <input
            type="text"
            value={collectionData?.name || ''}
            onChange={(e) => setCollectionData({ ...collectionData, name: e.target.value })}
            style={{
              width: '100%', padding: '0.5rem', border: '1px solid #d1d5db',
              borderRadius: '4px', fontSize: '1rem',
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="collection-wikipedia" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Wikipedia
          </label>
          <input
            id="collection-wikipedia"
            type="text"
            value={collectionData?.wikipedia || ''}
            onChange={(e) => setCollectionData({ ...collectionData, wikipedia: e.target.value })}
            placeholder="e.g., Kind_of_Blue"
            style={{
              width: '100%', padding: '0.5rem', border: '1px solid #d1d5db',
              borderRadius: '4px', fontSize: '1rem',
            }}
          />
          <small style={{ color: '#666', fontSize: '0.875rem' }}>
            The part after wikipedia.org/wiki/. Leave blank to skip Wikipedia lookup for this collection.
          </small>
        </div>

        {/* Current image */}
        {collectionData?.image_path && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Current Image
            </label>
            <img
              src={apiService.getImageUrl(collectionData.image_path, 'album_small')}
              alt="Collection cover"
              style={{ maxWidth: '200px', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
          </div>
        )}

        {/* Image download */}
        <div style={{
          padding: '1rem', backgroundColor: '#f9fafb',
          borderRadius: '4px', border: '1px solid #e5e7eb'
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Download Image from URL
          </h3>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Image URL</label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              style={{
                width: '100%', padding: '0.5rem', fontSize: '1rem',
                border: '1px solid #d1d5db', borderRadius: '4px',
              }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Save as Filename</label>
            <input
              type="text"
              value={imageName}
              onChange={(e) => setImageName(e.target.value)}
              placeholder="collection_cover.jpg"
              style={{
                width: '100%', padding: '0.5rem', fontSize: '1rem',
                border: '1px solid #d1d5db', borderRadius: '4px',
              }}
            />
          </div>
          <button
            onClick={handleDownloadImage}
            disabled={downloadingImage || !imageUrl || !imageName}
            style={{
              padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white',
              border: 'none', borderRadius: '4px', fontSize: '0.875rem',
              cursor: (downloadingImage || !imageUrl || !imageName) ? 'not-allowed' : 'pointer',
              opacity: (downloadingImage || !imageUrl || !imageName) ? 0.6 : 1,
            }}
          >
            {downloadingImage ? 'Downloading...' : 'Download & Save Image'}
          </button>
        </div>
      </div>

      {/* Add Album */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => { setShowSearch(!showSearch); setResolvingStubId(null); }}
          style={{
            padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white',
            border: 'none', borderRadius: '4px', cursor: 'pointer',
          }}
        >
          {showSearch ? 'Close Search' : '+ Add Album'}
        </button>
      </div>

      {showSearch && (
        <div
          ref={searchPanelRef}
          className="scroll-below-fixed-header"
          style={{
            backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem',
            marginBottom: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}
        >
          {resolvingStubId && (
            <div style={{
              marginBottom: '1rem', padding: '0.5rem 0.75rem', backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe', borderRadius: '4px', fontSize: '0.875rem', color: '#1e40af',
            }}>
              Resolving placeholder: <strong>{stubs.find((s) => s.id === resolvingStubId)?.title}</strong>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search for albums..."
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid #d1d5db',
                  borderRadius: '4px', fontSize: '1rem',
                }}
              />
            </div>
            <button
              onClick={handleSearch}
              style={{
                padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white',
                border: 'none', borderRadius: '4px', cursor: 'pointer',
              }}
            >
              Search
            </button>
          </div>

          {searchResults.length > 0 && (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {searchResults.map((album) => (
                <div
                  key={album.id}
                  onClick={() => handleAddAlbum(album)}
                  style={{
                    padding: '0.75rem', borderBottom: '1px solid #e5e7eb',
                    cursor: 'pointer', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <div>
                    <div style={{ fontWeight: '500' }}>{album.title}</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {album.artist?.name}
                    </div>
                  </div>
                  <button style={{
                    padding: '0.25rem 0.5rem', backgroundColor: '#10b981', color: 'white',
                    border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer',
                  }}>
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}

          {!showStubForm ? (
            <button
              type="button"
              onClick={() => setShowStubForm(true)}
              style={{
                marginTop: '0.75rem', padding: 0, background: 'none', border: 'none',
                color: '#3b82f6', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline',
              }}
            >
              Can't find it? Add a placeholder instead
            </button>
          ) : (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <label htmlFor="stub-title" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Title</label>
                <input
                  id="stub-title"
                  type="text"
                  value={stubTitle}
                  onChange={(e) => setStubTitle(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label htmlFor="stub-artist" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Artist</label>
                <input
                  id="stub-artist"
                  type="text"
                  value={stubArtistName}
                  onChange={(e) => setStubArtistName(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
                />
              </div>
              <button
                type="button"
                onClick={handleAddStub}
                disabled={!stubTitle.trim()}
                style={{
                  padding: '0.5rem 1rem', backgroundColor: stubTitle.trim() ? '#10b981' : '#d1d5db', color: 'white',
                  border: 'none', borderRadius: '4px', cursor: stubTitle.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Add Placeholder
              </button>
            </div>
          )}
        </div>
      )}

      {/* Albums list */}
      <div style={{
        backgroundColor: 'white', borderRadius: '0.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', overflow: 'hidden'
      }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', fontWeight: '600' }}>
          Albums ({albums.length}){stubs.length > 0 && `, ${stubs.length} placeholder${stubs.length === 1 ? '' : 's'}`}
        </div>

        {albums.length === 0 && stubs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
            No albums in this collection. Use the search above to add albums.
          </div>
        ) : (
          buildMergedItems().map((item, index) => {
            const isDropTarget = dragOverTarget?.type === item.type && dragOverTarget?.id === item.data.id;
            return (
            <div key={`${item.type}-${item.data.id}`}>
              {isDropTarget && dragOverTarget.position === 'before' && <DropIndicator />}
              {item.type === 'album' ? (
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onDragOver={(e) => handleDragOver(e, item)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, item)}
                style={{
                  padding: '1rem', borderBottom: '1px solid #e5e7eb',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: 'move',
                  backgroundColor: draggedItem?.type === 'album' && draggedItem?.id === item.data.id ? '#f3f4f6' : 'white',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                  <span style={{ color: '#6b7280', fontSize: '0.875rem', width: '2rem' }}>
                    {index + 1}
                  </span>
                  <span style={{ fontSize: '1.5rem', color: '#9ca3af', cursor: 'move' }}>☰</span>
                  {item.data.image_path && (
                    <img
                      src={apiService.getImageUrl(item.data.image_path, 'album_small')}
                      alt={item.data.title}
                      style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                      onError={(e) => {
                        if (e.target.src.includes('/sm/')) {
                          e.target.src = e.target.src.replace('/sm/', '/');
                          e.target.onerror = null;
                        }
                      }}
                    />
                  )}
                  <div>
                    <div style={{ fontWeight: '500' }}>{item.data.title}</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {item.data.artist?.name}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveAlbum(item.data.id)}
                  style={{
                    padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: 'white',
                    border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem',
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onDragOver={(e) => handleDragOver(e, item)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, item)}
                style={{
                  padding: '1rem', borderBottom: '1px solid #e5e7eb',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: 'move',
                  backgroundColor: draggedItem?.type === 'stub' && draggedItem?.id === item.data.id ? '#f3f4f6' : '#f9fafb',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                  <span style={{ color: '#6b7280', fontSize: '0.875rem', width: '2rem' }}>
                    {index + 1}
                  </span>
                  <span style={{ fontSize: '1.5rem', color: '#9ca3af', cursor: 'move' }}>☰</span>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '4px', border: '2px dashed #9ca3af',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af',
                  }}>▢</div>
                  <div>
                    <div style={{ fontWeight: '500' }}>{item.data.title}</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {item.data.artist_name}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => { setResolvingStubId(item.data.id); setShowSearch(true); setSearchQuery(''); setSearchResults([]); }}
                    style={{
                      padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white',
                      border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem',
                    }}
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => handleRemoveStub(item.data.id)}
                    style={{
                      padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: 'white',
                      border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem',
                    }}
                  >
                    Remove Placeholder
                  </button>
                </div>
              </div>
              )}
              {isDropTarget && dragOverTarget.position === 'after' && <DropIndicator />}
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}
