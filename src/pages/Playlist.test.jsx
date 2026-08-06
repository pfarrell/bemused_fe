import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Playlist from './Playlist';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { apiService } from '../services/api';

vi.mock('../services/api', () => ({
  apiService: {
    getPlaylist: vi.fn(),
    getImageUrl: () => 'http://example.com/image.jpg',
  },
}));

const playlistData = {
  playlist: { id: 20, name: 'Test Playlist', user_id: 1 },
  tracks: [
    { id: 1, title: 'Track One', duration: 180, artist: { name: 'Some Artist' } },
    { id: 2, title: 'Track Two', duration: 200, artist: { name: 'Some Artist' } },
  ],
};

const renderPlaylist = () =>
  render(
    <MemoryRouter initialEntries={['/playlist/20']}>
      <Routes>
        <Route path="/playlist/:id" element={<Playlist />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  apiService.getPlaylist.mockResolvedValue({ data: playlistData });
  useAuthStore.setState({ isAdmin: false, user: null, isAuthenticated: true });
  useFavoritesStore.setState({ isFavorite: () => false, toggleFavorite: vi.fn() });
});

describe('Playlist page', () => {
  test('registers the playlist tracks as pageTracks once loaded, so the footer play button can fall back to them', async () => {
    renderPlaylist();
    await screen.findByText('Test Playlist');

    // The name-render and the pageTracks-setting effect are two separate renders
    // (playlistData lands first, the passive effect that calls setPageTracks follows
    // asynchronously after paint) — waitFor avoids a race where this assertion runs
    // before that effect has flushed, most visible under heavy parallel test load.
    await waitFor(() => {
      expect(usePlayerStore.getState().pageTracks).toHaveLength(playlistData.tracks.length);
      expect(usePlayerStore.getState().pageTracks[0]).toMatchObject({ id: 1, title: 'Track One' });
    });
  });

  test('tags each loaded track with source_playlist matching this playlist', async () => {
    renderPlaylist();
    await screen.findByText('Test Playlist');

    await waitFor(() => {
      expect(usePlayerStore.getState().pageTracks).toEqual([
        { ...playlistData.tracks[0], source_playlist: { id: 20, name: 'Test Playlist' } },
        { ...playlistData.tracks[1], source_playlist: { id: 20, name: 'Test Playlist' } },
      ]);
    });
  });

  test('clears pageTracks on unmount so a stale playlist cannot be played from elsewhere', async () => {
    const { unmount } = renderPlaylist();
    await screen.findByText('Test Playlist');

    unmount();

    expect(usePlayerStore.getState().pageTracks).toEqual([]);
  });
});

describe('Playlist page — header context menu', () => {
  test('right-clicking the header shows Favorite', async () => {
    renderPlaylist();
    await screen.findByText('Test Playlist');

    fireEvent.contextMenu(screen.getByText('Test Playlist').closest('div'));

    expect(screen.getByText('☆ Add to Favorites')).toBeInTheDocument();
  });

  test('shows nothing on right-click when logged out', async () => {
    useAuthStore.setState({ isAdmin: false, user: null, isAuthenticated: false });
    renderPlaylist();
    await screen.findByText('Test Playlist');

    fireEvent.contextMenu(screen.getByText('Test Playlist').closest('div'));

    expect(screen.queryByText(/Favorites/)).not.toBeInTheDocument();
  });

  test('clicking Favorite calls toggleFavorite with the playlist kind/id', async () => {
    const toggleFavorite = vi.fn();
    useFavoritesStore.setState({ isFavorite: () => false, toggleFavorite });
    renderPlaylist();
    await screen.findByText('Test Playlist');

    fireEvent.contextMenu(screen.getByText('Test Playlist').closest('div'));
    fireEvent.click(screen.getByText('☆ Add to Favorites'));

    expect(toggleFavorite).toHaveBeenCalledWith('playlist', playlistData.playlist.id, expect.objectContaining({ id: playlistData.playlist.id, name: playlistData.playlist.name }));
  });
});
