import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminPlaylist from './AdminPlaylist';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';
import { useUnsavedChangesStore } from '../stores/unsavedChangesStore';

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

describe('AdminPlaylist — row context menu', () => {
  const threeTrackPayload = {
    playlist: { id: 20, name: 'Test Playlist', image_path: null, user_id: 1 },
    tracks: [
      { id: 1, title: 'One', artist: { name: 'X' }, album: { title: 'Alb' } },
      { id: 2, title: 'Two', artist: { name: 'X' }, album: { title: 'Alb' } },
      { id: 3, title: 'Three', artist: { name: 'X' }, album: { title: 'Alb' } },
    ],
  };

  beforeEach(() => {
    useAuthStore.setState({ isAdmin: true, user: { id: 1 } });
  });

  test('right-click opens a menu with Send to Top / Send to Bottom', async () => {
    apiService.getPlaylist.mockResolvedValue({ data: threeTrackPayload });
    renderAdminPlaylist();

    const trackTwoRow = (await screen.findByText('Two')).closest('[draggable]');
    expect(screen.queryByText('⬆ Send to Top')).not.toBeInTheDocument();

    fireEvent.contextMenu(trackTwoRow);

    expect(screen.getByText('⬆ Send to Top')).toBeInTheDocument();
    expect(screen.getByText('⬇ Send to Bottom')).toBeInTheDocument();
  });

  test('right-clicking the Delete button does not open the row menu', async () => {
    apiService.getPlaylist.mockResolvedValue({ data: threeTrackPayload });
    renderAdminPlaylist();

    const trackOneRow = (await screen.findByText('One')).closest('[draggable]');
    const deleteButton = trackOneRow.querySelector('button');
    fireEvent.contextMenu(deleteButton);

    expect(screen.queryByText('⬆ Send to Top')).not.toBeInTheDocument();
  });

  test('Send to Top moves a track to the front of the list', async () => {
    apiService.getPlaylist.mockResolvedValue({ data: threeTrackPayload });
    apiService.reorderPlaylistTracks = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    renderAdminPlaylist();

    const trackThreeRow = (await screen.findByText('Three')).closest('[draggable]');
    fireEvent.contextMenu(trackThreeRow);
    await user.click(screen.getByText('⬆ Send to Top'));

    const [, trackOrders] = apiService.reorderPlaylistTracks.mock.calls[0];
    const orderOf = (id) => trackOrders.find((t) => t.track_id === id)?.order;
    expect(orderOf(3)).toBe(1);
    expect(orderOf(1)).toBe(2);
    expect(orderOf(2)).toBe(3);
  });

  test('Send to Bottom moves a track to the end of the list', async () => {
    apiService.getPlaylist.mockResolvedValue({ data: threeTrackPayload });
    apiService.reorderPlaylistTracks = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    renderAdminPlaylist();

    const trackOneRow = (await screen.findByText('One')).closest('[draggable]');
    fireEvent.contextMenu(trackOneRow);
    await user.click(screen.getByText('⬇ Send to Bottom'));

    const [, trackOrders] = apiService.reorderPlaylistTracks.mock.calls[0];
    const orderOf = (id) => trackOrders.find((t) => t.track_id === id)?.order;
    expect(orderOf(2)).toBe(1);
    expect(orderOf(3)).toBe(2);
    expect(orderOf(1)).toBe(3);
  });

  test('a long-press also opens the row menu (mobile path)', async () => {
    apiService.getPlaylist.mockResolvedValue({ data: threeTrackPayload });
    renderAdminPlaylist();
    const trackOneRow = (await screen.findByText('One')).closest('[draggable]');

    vi.useFakeTimers();
    try {
      fireEvent.touchStart(trackOneRow, { touches: [{ clientX: 50, clientY: 50 }] });
      act(() => { vi.advanceTimersByTime(500); });
      expect(screen.getByText('⬆ Send to Top')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
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

describe('AdminPlaylist — unsavedChangesStore registration', () => {
  test('registers unsaved changes when a field is edited, clears on unmount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderAdminPlaylist();
    const nameInput = await screen.findByDisplayValue('Test Playlist');

    expect(useUnsavedChangesStore.getState().hasUnsavedChanges).toBe(false);

    await user.type(nameInput, ' Extra');
    await waitFor(() => expect(useUnsavedChangesStore.getState().hasUnsavedChanges).toBe(true));
    expect(useUnsavedChangesStore.getState().save).toBeInstanceOf(Function);

    unmount();
    expect(useUnsavedChangesStore.getState().hasUnsavedChanges).toBe(false);
    expect(useUnsavedChangesStore.getState().save).toBe(null);
  });

  test('the registered save function persists the edited fields', async () => {
    apiService.updatePlaylist.mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    renderAdminPlaylist();
    const nameInput = await screen.findByDisplayValue('Test Playlist');

    await user.type(nameInput, ' Extra');
    await waitFor(() => expect(useUnsavedChangesStore.getState().hasUnsavedChanges).toBe(true));

    await useUnsavedChangesStore.getState().save();

    expect(apiService.updatePlaylist).toHaveBeenCalledWith(
      '20',
      expect.objectContaining({ name: 'Test Playlist Extra' })
    );
    await waitFor(() => expect(useUnsavedChangesStore.getState().hasUnsavedChanges).toBe(false));
  });
});
