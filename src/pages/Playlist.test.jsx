import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Playlist from './Playlist';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';
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
  useAuthStore.setState({ isAdmin: false, user: null });
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
      expect(usePlayerStore.getState().pageTracks).toEqual(playlistData.tracks);
    });
  });

  test('clears pageTracks on unmount so a stale playlist cannot be played from elsewhere', async () => {
    const { unmount } = renderPlaylist();
    await screen.findByText('Test Playlist');

    unmount();

    expect(usePlayerStore.getState().pageTracks).toEqual([]);
  });
});
