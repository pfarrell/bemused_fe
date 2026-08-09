import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminPlaylist from './AdminPlaylist';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';

vi.mock('../services/api', () => ({
  apiService: {
    getPlaylist: vi.fn(),
    updatePlaylist: vi.fn(),
    addTrackToPlaylist: vi.fn(),
    removeTrackFromPlaylist: vi.fn(),
    reorderPlaylistTracks: vi.fn(),
    downloadPlaylistImage: vi.fn(),
    search: vi.fn(),
    getImageUrl: () => 'http://example.com/image.jpg',
  },
}));

const playlistPayload = {
  playlist: { id: 20, name: 'Test Playlist', image_path: null, user_id: 1 },
  tracks: [],
};

const renderAdminPlaylist = () =>
  render(
    <MemoryRouter initialEntries={['/admin/playlist/20']}>
      <Routes>
        <Route path="/admin/playlist/:id" element={<AdminPlaylist />} />
        <Route path="/playlist/:id" element={<div>Playlist view page</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  apiService.getPlaylist.mockResolvedValue({ data: playlistPayload });
});

describe('AdminPlaylist — ownership', () => {
  test('redirects a signed-in non-owner, non-admin user to the playlist view page', async () => {
    useAuthStore.setState({ isAdmin: false, user: { id: 99 } });
    renderAdminPlaylist();

    await waitFor(() => expect(screen.getByText('Playlist view page')).toBeInTheDocument());
    expect(screen.queryByText('Edit Playlist')).not.toBeInTheDocument();
  });

  test('renders the edit form for the playlist owner', async () => {
    useAuthStore.setState({ isAdmin: false, user: { id: 1 } });
    renderAdminPlaylist();

    expect(await screen.findByText('Edit Playlist')).toBeInTheDocument();
  });

  test('renders the edit form for an admin who does not own the playlist', async () => {
    useAuthStore.setState({ isAdmin: true, user: { id: 99 } });
    renderAdminPlaylist();

    expect(await screen.findByText('Edit Playlist')).toBeInTheDocument();
  });
});
