// src/pages/AdminTrack.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import Loading from '../components/Loading';
import TrackArtistPicker from '../components/TrackArtistPicker';
import MusicBrainzPicker from '../components/MusicBrainzPicker';
import toast from 'react-hot-toast';

const AdminTrack = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Editable form state
  const [title, setTitle] = useState('');
  const [trackNumber, setTrackNumber] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [wikipedia, setWikipedia] = useState('');
  const [albumId, setAlbumId] = useState('');
  const [artistId, setArtistId] = useState(null);
  const [artistName, setArtistName] = useState('');
  const [recordingMbid, setRecordingMbid] = useState('');
  const [mbidStatus, setMbidStatus] = useState('');

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const response = await apiService.getTrackAdminDetail(id);
        const data = response.data;
        setDetail(data);
        setTitle(data.track.title || '');
        setTrackNumber(data.track.track_number || '');
        setReleaseYear(data.track.release_year || '');
        setWikipedia(data.track.wikipedia || '');
        setAlbumId(data.track.album_id ?? '');
        setArtistId(data.track.artist_id ?? null);
        setArtistName(data.artist?.name || '');
        setRecordingMbid(data.mediaFile?.musicbrainz_recording_id || '');
        setMbidStatus(data.mediaFile?.mbid_status || '');
      } catch (err) {
        console.error('Error fetching track data:', err);
        setError('Failed to load track');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchDetail();
  }, [id]);

  useEffect(() => {
    if (!detail) return;
    const hasChanges =
      title !== (detail.track.title || '') ||
      trackNumber !== (detail.track.track_number || '') ||
      releaseYear !== (detail.track.release_year || '') ||
      wikipedia !== (detail.track.wikipedia || '') ||
      String(albumId) !== String(detail.track.album_id ?? '') ||
      artistId !== (detail.track.artist_id ?? null) ||
      recordingMbid !== (detail.mediaFile?.musicbrainz_recording_id || '');
    setHasUnsavedChanges(hasChanges);
  }, [title, trackNumber, releaseYear, wikipedia, albumId, artistId, recordingMbid, detail]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleClick = async (e) => {
      if (!hasUnsavedChanges) return;
      const link = e.target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#')) return;
      if (link.classList.contains('admin-back-link')) return;

      e.preventDefault();
      e.stopPropagation();

      const choice = window.confirm('You have unsaved changes. Click OK to save and leave, or Cancel to stay on this page.');
      if (choice) {
        try {
          await saveTrack();
          setTimeout(() => navigate(href), 0);
        } catch (err) {
          console.error('Error saving track:', err);
          setError(err.response?.data?.error || 'Failed to save track');
        }
      }
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [hasUnsavedChanges, id, title, trackNumber, releaseYear, wikipedia, albumId, artistId, recordingMbid, navigate]);

  const saveTrack = async () => {
    await apiService.updateTrack(id, {
      title,
      track_number: trackNumber,
      album_id: albumId === '' ? null : parseInt(albumId),
      artist_id: artistId,
      release_year: releaseYear,
      wikipedia,
    });
    if (recordingMbid !== (detail.mediaFile?.musicbrainz_recording_id || '')) {
      await apiService.updateTrackRecordingMbid(id, recordingMbid || null);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveTrack();
      setHasUnsavedChanges(false);
      toast.success('Track saved');
      navigate(`/album/${albumId}`);
    } catch (err) {
      console.error('Error saving track:', err);
      setError(err.response?.data?.error || 'Failed to save track');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  if (error && !detail) return <div style={{ padding: '2rem', color: '#dc2626' }}>{error}</div>;
  if (!detail) return null;

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <a href={`/album/${detail.track.album_id}`} className="admin-back-link" onClick={(e) => { e.preventDefault(); navigate(`/album/${detail.track.album_id}`); }}>
        ← Back to Album
      </a>

      <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: '1rem 0' }}>Edit Track</h1>

      {error && <div style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</div>}

      <form onSubmit={handleSave}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem' }}>Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }} />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem' }}>Track Number</label>
          <input type="text" value={trackNumber} onChange={(e) => setTrackNumber(e.target.value)} style={{ width: '100px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }} />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem' }}>Release Year</label>
          <input type="text" value={releaseYear} onChange={(e) => setReleaseYear(e.target.value)} style={{ width: '100px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }} />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem' }}>Album ID</label>
          <input type="number" value={albumId} onChange={(e) => setAlbumId(e.target.value)} style={{ width: '100px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }} />
          {detail.album?.musicbrainz_id && (
            <a href={`https://musicbrainz.org/release/${detail.album.musicbrainz_id}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0.75rem', fontSize: '0.875rem', color: '#3b82f6' }}>
              View album on MusicBrainz ↗
            </a>
          )}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem' }}>Primary Artist</label>
          <TrackArtistPicker
            artistName={artistName}
            onSelect={(newArtistId, newArtistName) => { setArtistId(newArtistId); setArtistName(newArtistName); }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem' }}>Wikipedia</label>
          <textarea value={wikipedia} onChange={(e) => setWikipedia(e.target.value)} rows={4} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }} />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem' }}>Recording MusicBrainz ID</label>
          <MusicBrainzPicker
            entityType="recording"
            value={recordingMbid}
            mbidStatus={mbidStatus}
            searchDefault={`${title} ${artistName}`}
            pending={recordingMbid !== (detail.mediaFile?.musicbrainz_recording_id || '')}
            onChange={setRecordingMbid}
          />
        </div>

        <button type="submit" disabled={saving} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </div>
  );
};

export default AdminTrack;
