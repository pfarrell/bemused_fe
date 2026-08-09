import { render, screen, waitFor } from '@testing-library/react';
import AddToPlaylistModal from './AddToPlaylistModal';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';

vi.mock('../services/api', () => ({
  apiService: {
    getPlaylists: vi.fn(),
    getPlaylist: vi.fn(),
    addTrackToPlaylist: vi.fn(),
    createPlaylist: vi.fn(),
  },
}));

const track = { id: 1, title: 'Test Track' };

const playlists = [
  { id: 10, name: 'My Playlist', user_id: 5 },
  { id: 11, name: "Someone Else's Playlist", user_id: 99 },
];

beforeEach(() => {
  apiService.getPlaylists.mockResolvedValue({ data: playlists });
});

test('only lists playlists owned by the current user when not admin', async () => {
  useAuthStore.setState({ isAdmin: false, user: { id: 5 } });
  render(<AddToPlaylistModal track={track} onClose={vi.fn()} />);

  await waitFor(() => expect(screen.getByText('My Playlist')).toBeInTheDocument());
  expect(screen.queryByText("Someone Else's Playlist")).not.toBeInTheDocument();
});

test('lists every playlist when the current user is admin', async () => {
  useAuthStore.setState({ isAdmin: true, user: { id: 1 } });
  render(<AddToPlaylistModal track={track} onClose={vi.fn()} />);

  await waitFor(() => expect(screen.getByText('My Playlist')).toBeInTheDocument());
  expect(screen.getByText("Someone Else's Playlist")).toBeInTheDocument();
});

test('lists no playlists when logged out (no matching user)', async () => {
  useAuthStore.setState({ isAdmin: false, user: null });
  render(<AddToPlaylistModal track={track} onClose={vi.fn()} />);

  await waitFor(() => expect(apiService.getPlaylists).toHaveBeenCalled());
  expect(screen.queryByText('My Playlist')).not.toBeInTheDocument();
  expect(screen.queryByText("Someone Else's Playlist")).not.toBeInTheDocument();
});
