import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import Track from './Track';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';
import { useFavoritesStore } from '../stores/favoritesStore';

vi.mock('./AddToPlaylistModal', () => ({ default: () => null }));
vi.mock('./TrackNotesModal', () => ({ default: () => null }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: vi.fn() };
});

const mockTrack = {
  id: 1,
  title: 'Test Track',
  duration: 180,
  artist: { id: 2, name: 'Test Artist' },
  album: {
    id: 10,
    title: 'Test Album',
    artist: { id: 5, name: 'Album Artist' },
  },
  download_url: 'http://localhost:3000/download/1',
};

const renderTrack = (props = {}) =>
  render(
    <MemoryRouter>
      <Track track={mockTrack} index={0} trackCount={1} {...props} />
    </MemoryRouter>
  );

beforeEach(() => {
  usePlayerStore.setState({
    playlist: [],
    currentTrack: null,
    isPlaying: false,
    currentTrackIndex: -1,
    addTrack: vi.fn(),
    addTracks: vi.fn(),
    clearPlaylist: vi.fn(),
    playTrackAtIndex: vi.fn(),
  });
  useAuthStore.setState({ isAuthenticated: false });
  useFavoritesStore.setState({ isFavorite: () => false, toggleFavorite: vi.fn() });
  useNavigate.mockReturnValue(vi.fn());
});

describe('Track component', () => {
  test('renders the track title', () => {
    renderTrack();
    expect(screen.getByText(/Test Track/)).toBeInTheDocument();
  });

  test('renders track number', () => {
    renderTrack();
    expect(screen.getByText(/01\./)).toBeInTheDocument();
  });

  test('renders play button when not playing', () => {
    renderTrack({ isPlaying: false });
    // The ▶ symbol appears in the play button span; use getAllByText since it also
    // appears in the "▶ Play Now" dropdown button (hidden until right-click)
    const playButtons = screen.getAllByText('▶');
    expect(playButtons.length).toBeGreaterThan(0);
  });

  test('renders now-playing indicator when isPlaying is true', () => {
    renderTrack({ isPlaying: true });
    expect(screen.getByText('♪')).toBeInTheDocument();
  });

  test('does not render album link when includeMeta is false', () => {
    renderTrack({ includeMeta: false });
    expect(screen.queryByText('Test Album')).not.toBeInTheDocument();
  });

  test('renders album link when includeMeta is true', () => {
    renderTrack({ includeMeta: true });
    expect(screen.getByText('Test Album')).toBeInTheDocument();
  });

  test('renders artist link when includeMeta is true', () => {
    renderTrack({ includeMeta: true });
    expect(screen.getByText('Album Artist')).toBeInTheDocument();
  });

  test('renders formatted duration', () => {
    renderTrack();
    expect(screen.getByText('(3:00)')).toBeInTheDocument();
  });

  test('long-press menu stays open after finger release, closes on a later tap-away', () => {
    vi.useFakeTimers();
    renderTrack();
    const row = screen.getByText(/Test Track/).closest('.track-item');

    // Long-press opens the menu (finger still down)
    fireEvent.touchStart(row, { touches: [{ clientX: 50, clientY: 50 }] });
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText('▶ Play Now')).toBeInTheDocument();

    // Finger lifts, then the synthesized click lands on the backdrop — menu must persist
    fireEvent.touchEnd(row);
    fireEvent.click(screen.getByTestId('track-menu-backdrop'));
    expect(screen.getByText('▶ Play Now')).toBeInTheDocument();

    // After the release window, a deliberate tap on the backdrop closes it
    act(() => { vi.advanceTimersByTime(350); });
    fireEvent.click(screen.getByTestId('track-menu-backdrop'));
    expect(screen.queryByText('▶ Play Now')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  test('Notes menu item closes the dropdown when clicked', () => {
    renderTrack();
    fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));
    expect(screen.getByText('📝 Notes')).toBeInTheDocument();

    fireEvent.click(screen.getByText('📝 Notes'));
    expect(screen.queryByText('▶ Play Now')).not.toBeInTheDocument();
  });

  const renderWithPlayer = () => {
    usePlayerStore.setState({
      playlist: [],
      addTrack: vi.fn(),
      addTracks: vi.fn(),
      clearPlaylist: vi.fn(),
      playTrackAtIndex: vi.fn(),
    });
    return renderTrack();
  };

  test('Add to Queue flags activity for the player to pulse', () => {
    renderWithPlayer();
    fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));
    fireEvent.click(screen.getByText('➕ Add to Queue'));
    expect(usePlayerStore.getState().addTrack).toHaveBeenCalledWith(mockTrack, { flashActivity: true });
  });

  test('Play Next flags activity for the player to pulse', () => {
    renderWithPlayer();
    fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));
    fireEvent.click(screen.getByText('⏭ Play Next'));
    expect(usePlayerStore.getState().addTracks).toHaveBeenCalledWith([mockTrack], true, { flashActivity: true });
  });

  test('Play Now does not flag activity (footer change is the feedback)', () => {
    renderWithPlayer();
    fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));
    fireEvent.click(screen.getByText('▶ Play Now'));
    expect(usePlayerStore.getState().addTrack).toHaveBeenCalledWith(mockTrack);
    expect(usePlayerStore.getState().addTracks).not.toHaveBeenCalled();
  });

  test('Add to Queue flashes the pressed button before the menu closes', () => {
    renderWithPlayer();
    fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));
    const button = screen.getByText('➕ Add to Queue');
    fireEvent.click(button);
    expect(button).toHaveClass('menu-btn-pressed');
  });

  test('Play Next flashes the pressed button before the menu closes', () => {
    renderWithPlayer();
    fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));
    const button = screen.getByText('⏭ Play Next');
    fireEvent.click(button);
    expect(button).toHaveClass('menu-btn-pressed');
  });

  describe('Download menu item', () => {
    afterEach(() => {
      import.meta.env.VITE_ENABLE_DOWNLOADS = 'false';
    });

    test('does not render when logged out, even if the flag is enabled', () => {
      import.meta.env.VITE_ENABLE_DOWNLOADS = 'true';
      useAuthStore.setState({ isAuthenticated: false });
      renderTrack();
      fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));
      expect(screen.queryByText('⬇ Download')).not.toBeInTheDocument();
    });

    test('does not render when logged in but the flag is disabled', () => {
      import.meta.env.VITE_ENABLE_DOWNLOADS = 'false';
      useAuthStore.setState({ isAuthenticated: true });
      renderTrack();
      fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));
      expect(screen.queryByText('⬇ Download')).not.toBeInTheDocument();
    });

    test('renders when logged in and the flag is enabled', () => {
      import.meta.env.VITE_ENABLE_DOWNLOADS = 'true';
      useAuthStore.setState({ isAuthenticated: true });
      renderTrack();
      fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));
      expect(screen.getByText('⬇ Download')).toBeInTheDocument();
    });

    test('renders by default when the flag is unset (on unless explicitly disabled)', () => {
      delete import.meta.env.VITE_ENABLE_DOWNLOADS;
      useAuthStore.setState({ isAuthenticated: true });
      renderTrack();
      fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));
      expect(screen.getByText('⬇ Download')).toBeInTheDocument();
    });

    test('clicking Download navigates to the track download_url and closes the menu', () => {
      import.meta.env.VITE_ENABLE_DOWNLOADS = 'true';
      useAuthStore.setState({ isAuthenticated: true });
      // jsdom's window.location is non-configurable; redefine it with
      // writable: true rather than deleting it (which throws in jsdom 29).
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { href: '' },
      });
      renderTrack();
      fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));
      fireEvent.click(screen.getByText('⬇ Download'));
      expect(window.location.href).toBe(mockTrack.download_url);
      expect(screen.queryByText('⬇ Download')).not.toBeInTheDocument();
    });
  });

});

describe('Track component — per-track artist display', () => {
  test('shows track artist suffix when ids differ, even if names happen to match', () => {
    renderTrack({
      track: {
        ...mockTrack,
        artist: { id: 99, name: 'Album Artist' },
        album: { ...mockTrack.album, artist: { id: 5, name: 'Album Artist' } },
      },
    });
    expect(screen.getByText(/- Album Artist/)).toBeInTheDocument();
  });

  test('hides track artist suffix when ids match, even if names differ', () => {
    renderTrack({
      track: {
        ...mockTrack,
        artist: { id: 5, name: 'Renamed Artist' },
        album: { ...mockTrack.album, artist: { id: 5, name: 'Album Artist' } },
      },
    });
    expect(screen.queryByText(/- Renamed Artist/)).not.toBeInTheDocument();
  });

  test('does not crash when the track has no album (orphaned track, no FK constraint on tracks.album_id)', () => {
    renderTrack({
      track: {
        ...mockTrack,
        artist: { id: 99, name: 'Orphan Artist' },
        album: null,
      },
    });
    expect(screen.getByText(/- Orphan Artist/)).toBeInTheDocument();
  });
});

describe('Track component — Favorite menu item', () => {
  test('does not render when logged out', () => {
    useAuthStore.setState({ isAuthenticated: false });
    renderTrack();
    fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));
    expect(screen.queryByText(/Favorites/)).not.toBeInTheDocument();
  });

  test('shows "Add to Favorites" when not yet favorited', () => {
    useAuthStore.setState({ isAuthenticated: true });
    useFavoritesStore.setState({ isFavorite: () => false, toggleFavorite: vi.fn() });
    renderTrack();
    fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));
    expect(screen.getByText('☆ Add to Favorites')).toBeInTheDocument();
  });

  test('shows "Remove from Favorites" when already favorited', () => {
    useAuthStore.setState({ isAuthenticated: true });
    useFavoritesStore.setState({ isFavorite: () => true, toggleFavorite: vi.fn() });
    renderTrack();
    fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));
    expect(screen.getByText('★ Remove from Favorites')).toBeInTheDocument();
  });

  test('clicking it calls toggleFavorite with the track kind/id and closes the menu', () => {
    useAuthStore.setState({ isAuthenticated: true });
    const toggleFavorite = vi.fn();
    useFavoritesStore.setState({ isFavorite: () => false, toggleFavorite });
    renderTrack();
    fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));

    fireEvent.click(screen.getByText('☆ Add to Favorites'));

    expect(toggleFavorite).toHaveBeenCalledWith('track', mockTrack.id, expect.objectContaining({ id: mockTrack.id, title: mockTrack.title }));
    expect(screen.queryByText('☆ Add to Favorites')).not.toBeInTheDocument();
  });
});

describe('Track component — Go to Album / Go to Artist menu items', () => {
  test('Go to Album navigates to the track\'s album and closes the menu', () => {
    const navigate = vi.fn();
    useNavigate.mockReturnValue(navigate);
    renderTrack();
    fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));

    fireEvent.click(screen.getByText('💿 Go to Album'));

    expect(navigate).toHaveBeenCalledWith('/album/10');
    expect(screen.queryByText('💿 Go to Album')).not.toBeInTheDocument();
  });

  test('Go to Album is absent when the track has no album', () => {
    renderTrack({ track: { ...mockTrack, album: null } });
    fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));
    expect(screen.queryByText('💿 Go to Album')).not.toBeInTheDocument();
  });

  test('Go to Artist navigates to the track\'s artist and closes the menu', () => {
    const navigate = vi.fn();
    useNavigate.mockReturnValue(navigate);
    renderTrack();
    fireEvent.contextMenu(screen.getByText(/Test Track/).closest('.track-item'));

    fireEvent.click(screen.getByText('🎤 Go to Artist'));

    expect(navigate).toHaveBeenCalledWith('/artist/2');
    expect(screen.queryByText('🎤 Go to Artist')).not.toBeInTheDocument();
  });
});
