import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AlbumCard from './AlbumCard';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';
import { useFavoritesStore } from '../stores/favoritesStore';

vi.mock('./AddToCollectionModal', () => ({ default: () => null }));
vi.mock('../services/api', () => ({
  apiService: {
    getAlbum: vi.fn(),
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: vi.fn(), useLocation: vi.fn() };
});

const album = { id: 7, title: 'Test Album', image_path: 'x.jpg' };
const artist = { id: 3, name: 'Test Artist' };

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
});

beforeEach(() => {
  useNavigate.mockReturnValue(vi.fn());
  useLocation.mockReturnValue({ pathname: '/' });
});

test('shows a "+" after the artist name when the album has collaborators', () => {
  render(
    <AlbumCard
      album={{ ...album, has_collaborators: true }}
      artist={artist}
      onClick={vi.fn()}
      imageUrl="/img/sm/x.jpg"
    />
  );
  expect(screen.getByText('Test Artist +')).toBeInTheDocument();
});

test('does not show a "+" when the album has no collaborators', () => {
  render(
    <AlbumCard
      album={album}
      artist={artist}
      onClick={vi.fn()}
      imageUrl="/img/sm/x.jpg"
    />
  );
  expect(screen.getByText('Test Artist')).toBeInTheDocument();
});

test('tapping the cover image navigates via onClick, not an expand modal, even when a full image URL is supplied', () => {
  const onClick = vi.fn();
  render(
    <AlbumCard
      album={album}
      artist={artist}
      onClick={onClick}
      imageUrl="/img/sm/x.jpg"
      fullImageUrl="/img/full/x.jpg"
    />
  );

  fireEvent.click(screen.getByRole('img', { name: /Test Album/ }));

  expect(onClick).toHaveBeenCalledWith(album);
  expect(document.querySelector('[style*="zoom-out"]')).toBeNull();
});

test('shows the track count when present', () => {
  render(
    <AlbumCard
      album={{ ...album, track_count: 12 }}
      artist={artist}
      onClick={vi.fn()}
      imageUrl="/img/sm/x.jpg"
    />
  );
  expect(screen.getByText('12 tracks')).toBeInTheDocument();
});

test('uses singular "track" for a count of 1', () => {
  render(
    <AlbumCard
      album={{ ...album, track_count: 1 }}
      artist={artist}
      onClick={vi.fn()}
      imageUrl="/img/sm/x.jpg"
    />
  );
  expect(screen.getByText('1 track')).toBeInTheDocument();
});

test('does not render a track count when track_count is absent', () => {
  render(
    <AlbumCard
      album={album}
      artist={artist}
      onClick={vi.fn()}
      imageUrl="/img/sm/x.jpg"
    />
  );
  expect(screen.queryByText(/track/)).toBeNull();
});

test('hides the artist name when hideArtist is set', () => {
  render(
    <AlbumCard
      album={album}
      artist={artist}
      onClick={vi.fn()}
      imageUrl="/img/sm/x.jpg"
      hideArtist
    />
  );
  expect(screen.queryByText('Test Artist')).toBeNull();
});

test('shows the artist name by default', () => {
  render(
    <AlbumCard
      album={album}
      artist={artist}
      onClick={vi.fn()}
      imageUrl="/img/sm/x.jpg"
    />
  );
  expect(screen.getByText('Test Artist')).toBeInTheDocument();
});

describe('mobile row layout', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
  });

  test('shows a single "Album · {artist}" subtitle, including the collaborator "+"', () => {
    render(
      <AlbumCard
        album={{ ...album, has_collaborators: true }}
        artist={artist}
        onClick={vi.fn()}
        imageUrl="/img/sm/x.jpg"
      />
    );
    expect(screen.getByText('Album · Test Artist +')).toBeInTheDocument();
  });

  test('shows just "Album" as the subtitle when hideArtist is set', () => {
    render(
      <AlbumCard
        album={album}
        artist={artist}
        onClick={vi.fn()}
        imageUrl="/img/sm/x.jpg"
        hideArtist
      />
    );
    expect(screen.getByText('Album')).toBeInTheDocument();
    expect(screen.queryByText('Test Artist')).toBeNull();
  });

  test('appends the track count in parentheses when present', () => {
    render(
      <AlbumCard
        album={{ ...album, track_count: 12 }}
        artist={artist}
        onClick={vi.fn()}
        imageUrl="/img/sm/x.jpg"
      />
    );
    expect(screen.getByText('Album · Test Artist (12 tracks)')).toBeInTheDocument();
  });

  test('uses singular "track" in the parenthetical for a count of 1', () => {
    render(
      <AlbumCard
        album={{ ...album, track_count: 1 }}
        artist={artist}
        onClick={vi.fn()}
        imageUrl="/img/sm/x.jpg"
      />
    );
    expect(screen.getByText('Album · Test Artist (1 track)')).toBeInTheDocument();
  });

  test('omits the parenthetical when track_count is absent', () => {
    render(
      <AlbumCard
        album={album}
        artist={artist}
        onClick={vi.fn()}
        imageUrl="/img/sm/x.jpg"
      />
    );
    expect(screen.getByText('Album · Test Artist')).toBeInTheDocument();
  });

  test('shows the track count in the subtitle even when hideArtist is set', () => {
    render(
      <AlbumCard
        album={{ ...album, track_count: 8 }}
        artist={artist}
        onClick={vi.fn()}
        imageUrl="/img/sm/x.jpg"
        hideArtist
      />
    );
    expect(screen.getByText('Album (8 tracks)')).toBeInTheDocument();
  });

  test('does not crash when artist is null (an orphaned album with no FK-enforced artist)', () => {
    render(
      <AlbumCard
        album={album}
        artist={null}
        onClick={vi.fn()}
        imageUrl="/img/sm/x.jpg"
      />
    );
    expect(screen.getByText('Album ·')).toBeInTheDocument();
  });

  test('tapping play fetches the album, replaces the queue, and does not navigate', async () => {
    apiService.getAlbum.mockResolvedValue({
      data: { tracks: [{ id: 1, title: 'Track One', url: 'http://x/1.mp3' }] },
    });
    const clearPlaylist = vi.fn();
    const addTracks = vi.fn();
    usePlayerStore.setState({ clearPlaylist, addTracks });
    const onClick = vi.fn();

    render(<AlbumCard album={album} artist={artist} onClick={onClick} imageUrl="/img/sm/x.jpg" />);

    fireEvent.click(screen.getByRole('button', { name: 'Play Test Album' }));

    await waitFor(() => expect(addTracks).toHaveBeenCalled());

    expect(apiService.getAlbum).toHaveBeenCalledWith(7);
    expect(clearPlaylist).toHaveBeenCalled();
    expect(addTracks).toHaveBeenCalledWith([{ id: 1, title: 'Track One', url: 'http://x/1.mp3' }]);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('right-clicking play and choosing "Play Next" fetches the album and inserts it next in the queue', async () => {
    apiService.getAlbum.mockResolvedValue({
      data: { tracks: [{ id: 1, title: 'Track One', url: 'http://x/1.mp3' }] },
    });
    const clearPlaylist = vi.fn();
    const addTracks = vi.fn();
    usePlayerStore.setState({ clearPlaylist, addTracks });

    render(<AlbumCard album={album} artist={artist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Play Test Album' }), { clientX: 10, clientY: 10 });

    fireEvent.click(screen.getByText('⏭ Play Next'));

    await waitFor(() => expect(addTracks).toHaveBeenCalled());
    expect(apiService.getAlbum).toHaveBeenCalledWith(7);
    expect(clearPlaylist).not.toHaveBeenCalled();
    expect(addTracks).toHaveBeenCalledWith(
      [{ id: 1, title: 'Track One', url: 'http://x/1.mp3' }],
      true,
      { flashActivity: true }
    );
  });

  test('right-clicking play and choosing "Add to Queue" fetches the album and appends it to the queue', async () => {
    apiService.getAlbum.mockResolvedValue({
      data: { tracks: [{ id: 1, title: 'Track One', url: 'http://x/1.mp3' }] },
    });
    const clearPlaylist = vi.fn();
    const addTracks = vi.fn();
    usePlayerStore.setState({ clearPlaylist, addTracks });

    render(<AlbumCard album={album} artist={artist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Play Test Album' }), { clientX: 10, clientY: 10 });

    fireEvent.click(screen.getByText('➕ Add to Queue'));

    await waitFor(() => expect(addTracks).toHaveBeenCalled());
    expect(apiService.getAlbum).toHaveBeenCalledWith(7);
    expect(clearPlaylist).not.toHaveBeenCalled();
    expect(addTracks).toHaveBeenCalledWith(
      [{ id: 1, title: 'Track One', url: 'http://x/1.mp3' }],
      false,
      { flashActivity: true }
    );
  });

  test('a failed play-all fetch clears the loading state without throwing', async () => {
    apiService.getAlbum.mockRejectedValue(new Error('network error'));
    usePlayerStore.setState({ clearPlaylist: vi.fn(), addTracks: vi.fn() });

    render(<AlbumCard album={album} artist={artist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);

    const playButton = screen.getByRole('button', { name: 'Play Test Album' });
    fireEvent.click(playButton);

    await waitFor(() => expect(playButton).not.toBeDisabled());
  });

  test('a long-press starting on the play button does not open the "Add to Collection" dropdown', () => {
    usePlayerStore.setState({ clearPlaylist: vi.fn(), addTracks: vi.fn() });
    vi.useFakeTimers();
    render(<AlbumCard album={album} artist={artist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);

    const playButton = screen.getByRole('button', { name: 'Play Test Album' });
    fireEvent.touchStart(playButton, { touches: [{ clientX: 10, clientY: 10 }] });
    act(() => { vi.advanceTimersByTime(500); });

    expect(screen.queryByText('▣ Add to Collection')).toBeNull();
    vi.useRealTimers();
  });
});

describe('AlbumCard — Favorite menu item', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false });
    useFavoritesStore.setState({ isFavorite: () => false, toggleFavorite: vi.fn() });
  });

  test('does not render when logged out', () => {
    render(<AlbumCard album={album} artist={artist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    fireEvent.contextMenu(screen.getByText('Test Album').closest('.artist-card'));
    expect(screen.queryByText(/Favorites/)).not.toBeInTheDocument();
  });

  test('shows "Add to Favorites" alongside "Add to Collection" when logged in', () => {
    useAuthStore.setState({ isAuthenticated: true });
    render(<AlbumCard album={album} artist={artist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    fireEvent.contextMenu(screen.getByText('Test Album').closest('.artist-card'));
    expect(screen.getByText('▣ Add to Collection')).toBeInTheDocument();
    expect(screen.getByText('☆ Add to Favorites')).toBeInTheDocument();
  });

  test('clicking it calls toggleFavorite with the album kind/id', () => {
    useAuthStore.setState({ isAuthenticated: true });
    const toggleFavorite = vi.fn();
    useFavoritesStore.setState({ isFavorite: () => false, toggleFavorite });
    render(<AlbumCard album={album} artist={artist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    fireEvent.contextMenu(screen.getByText('Test Album').closest('.artist-card'));

    fireEvent.click(screen.getByText('☆ Add to Favorites'));

    expect(toggleFavorite).toHaveBeenCalledWith('album', album.id, expect.objectContaining({ id: album.id, title: album.title }));
  });
});

describe('AlbumCard — Go to Artist menu item', () => {
  test('navigates to the artist and closes the menu', () => {
    const navigate = vi.fn();
    useNavigate.mockReturnValue(navigate);
    render(<AlbumCard album={album} artist={artist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    fireEvent.contextMenu(screen.getByText('Test Album').closest('.artist-card'));

    fireEvent.click(screen.getByText('🎤 Go to Artist'));

    expect(navigate).toHaveBeenCalledWith('/artist/3');
    expect(screen.queryByText('🎤 Go to Artist')).not.toBeInTheDocument();
  });

  test('is absent when no artist is provided', () => {
    render(<AlbumCard album={album} artist={null} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    fireEvent.contextMenu(screen.getByText('Test Album').closest('.artist-card'));
    expect(screen.queryByText('🎤 Go to Artist')).not.toBeInTheDocument();
  });

  test('is absent when already on that artist\'s page', () => {
    useLocation.mockReturnValue({ pathname: '/artist/3' });
    render(<AlbumCard album={album} artist={artist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    fireEvent.contextMenu(screen.getByText('Test Album').closest('.artist-card'));
    expect(screen.queryByText('🎤 Go to Artist')).not.toBeInTheDocument();
  });

  test('renders when on a different page', () => {
    useLocation.mockReturnValue({ pathname: '/artist/999' });
    render(<AlbumCard album={album} artist={artist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    fireEvent.contextMenu(screen.getByText('Test Album').closest('.artist-card'));
    expect(screen.getByText('🎤 Go to Artist')).toBeInTheDocument();
  });
});
