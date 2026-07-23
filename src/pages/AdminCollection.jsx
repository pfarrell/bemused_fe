// src/pages/AdminCollection.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

export default function AdminCollection() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [collectionData, setCollectionData] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Search to add albums
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  // Image download
  const [imageUrl, setImageUrl] = useState('');
  const [imageName, setImageName] = useState('');
  const [downloadingImage, setDownloadingImage] = useState(false);

  useEffect(() => {
    loadCollection();
  }, [id]);

  const loadCollection = async () => {
    try {
      setLoading(true);
      const response = await apiService.getCollection(id);
      setCollectionData(response.data.collection);
      setAlbums(response.data.albums || []);
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
    if (albums.some(a => a.id === album.id)) {
      alert('This album is already in the collection');
      return;
    }
    try {
      await apiService.addAlbumToCollection(id, album.id);
      setAlbums([...albums, { ...album, artist: album.artist || { id: null, name: album.artist_name || '' } }]);
      setShowSearch(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      console.error('Failed to add album:', err);
      alert('Failed to add album');
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

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newAlbums = [...albums];
    const [moved] = newAlbums.splice(draggedIndex, 1);
    newAlbums.splice(dropIndex, 0, moved);
    setAlbums(newAlbums);
    setDraggedIndex(null);

    try {
      const album_orders = newAlbums.map((a, i) => ({ album_id: a.id, order: i + 1 }));
      await apiService.reorderCollectionAlbums(id, album_orders);
    } catch (err) {
      console.error('Failed to reorder albums:', err);
      alert('Failed to save album order');
      loadCollection();
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiService.updateCollection(id, {
        name: collectionData.name,
        image_path: collectionData.image_path,
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

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

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
          onClick={() => setShowSearch(!showSearch)}
          style={{
            padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white',
            border: 'none', borderRadius: '4px', cursor: 'pointer',
          }}
        >
          {showSearch ? 'Close Search' : '+ Add Album'}
        </button>
      </div>

      {showSearch && (
        <div style={{
          backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem',
          marginBottom: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search for albums..."
              style={{
                flex: 1, padding: '0.5rem', border: '1px solid #d1d5db',
                borderRadius: '4px', fontSize: '1rem',
              }}
            />
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
        </div>
      )}

      {/* Albums list */}
      <div style={{
        backgroundColor: 'white', borderRadius: '0.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', overflow: 'hidden'
      }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', fontWeight: '600' }}>
          Albums ({albums.length})
        </div>

        {albums.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
            No albums in this collection. Use the search above to add albums.
          </div>
        ) : (
          albums.map((album, index) => (
            <div
              key={album.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              style={{
                padding: '1rem', borderBottom: '1px solid #e5e7eb',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'move', backgroundColor: draggedIndex === index ? '#f3f4f6' : 'white',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                <span style={{ color: '#6b7280', fontSize: '0.875rem', width: '2rem' }}>
                  {index + 1}
                </span>
                <span style={{ fontSize: '1.5rem', color: '#9ca3af', cursor: 'move' }}>☰</span>
                {album.image_path && (
                  <img
                    src={apiService.getImageUrl(album.image_path, 'album_small')}
                    alt={album.title}
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
                  <div style={{ fontWeight: '500' }}>{album.title}</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {album.artist?.name}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRemoveAlbum(album.id)}
                style={{
                  padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: 'white',
                  border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem',
                }}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
