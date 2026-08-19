import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminTrack from './AdminTrack';
import { apiService } from '../services/api';

vi.mock('../services/api', () => ({
  apiService: {
    getTrackAdminDetail: vi.fn(),
    updateTrack: vi.fn(),
    updateTrackRecordingMbid: vi.fn(),
    addTrackCollaborator: vi.fn(),
    removeTrackCollaborator: vi.fn(),
    searchAdminArtists: vi.fn(),
  },
}));

const mockDetail = {
  track: {
    id: 1, title: 'Test Track', track_number: '3', release_year: '1999',
    album_id: 10, artist_id: 20, media_file_id: 30, wikipedia: '',
    duration_sec: 210, approved: true,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
  },
  mediaFile: {
    id: 30, absolute_path: '/music/artist/album/track.mp3', name: 'track.mp3',
    file_type: 'mp3', file_hash: 'abc123', chromaprint_fingerprint: 'AQAB...',
    chromaprint_duration_sec: 210, imported_date: '2026-01-01T00:00:00Z',
    last_modified: '2026-01-01T00:00:00Z', musicbrainz_recording_id: null,
    mbid_status: 'unmatched', mbid_confidence: null,
  },
  album: { id: 10, title: 'Test Album', musicbrainz_id: 'release-uuid-1' },
  artist: { id: 20, name: 'Test Artist' },
  collaborators: [],
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/admin/track/1']}>
    <Routes>
      <Route path="/admin/track/:id" element={<AdminTrack />} />
    </Routes>
  </MemoryRouter>
);

describe('AdminTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getTrackAdminDetail.mockResolvedValue({ data: mockDetail });
  });

  it('fetches and renders the track title field', async () => {
    renderPage();
    await waitFor(() => expect(apiService.getTrackAdminDetail).toHaveBeenCalledWith('1'));
    expect(await screen.findByDisplayValue('Test Track')).toBeInTheDocument();
  });

  it('saves edited fields via updateTrack', async () => {
    apiService.updateTrack.mockResolvedValue({ data: { ...mockDetail.track, title: 'New Title' } });
    renderPage();
    const titleInput = await screen.findByDisplayValue('Test Track');
    fireEvent.change(titleInput, { target: { value: 'New Title' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(apiService.updateTrack).toHaveBeenCalledWith('1', expect.objectContaining({ title: 'New Title' })));
  });

  it('renders read-only media file info', async () => {
    renderPage();
    expect(await screen.findByText('/music/artist/album/track.mp3')).toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument();
  });

  it('adds a collaborator immediately (not batched with Save)', async () => {
    apiService.addTrackCollaborator.mockResolvedValue({
      data: { id: 99, track_id: 1, artist_id: 40, role: 'featured', order: 1 },
    });
    apiService.searchAdminArtists.mockResolvedValue({ data: [{ id: 40, name: 'Collab Artist' }] });
    renderPage();
    await screen.findByDisplayValue('Test Track');

    fireEvent.click(screen.getByText('Add Collaborator'));
    fireEvent.change(screen.getByPlaceholderText('Search artist name...'), { target: { value: 'Collab' } });
    fireEvent.click(screen.getByText('Search', { selector: 'button' }));
    await waitFor(() => expect(screen.getByText('Collab Artist')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Collab Artist'));

    await waitFor(() => expect(apiService.addTrackCollaborator).toHaveBeenCalledWith('1', 40, 'featured'));
    // Not part of the batched save call:
    expect(apiService.updateTrack).not.toHaveBeenCalled();
  });

  it('removes a collaborator immediately', async () => {
    apiService.getTrackAdminDetail.mockResolvedValue({
      data: { ...mockDetail, collaborators: [{ id: 5, artist_id: 40, artist_name: 'Collab Artist', role: 'featured', order: 1 }] },
    });
    apiService.removeTrackCollaborator.mockResolvedValue({ data: { success: true } });
    renderPage();
    await screen.findByText('Collab Artist');
    fireEvent.click(screen.getByText('Remove'));
    await waitFor(() => expect(apiService.removeTrackCollaborator).toHaveBeenCalledWith('1', 5));
  });
});
