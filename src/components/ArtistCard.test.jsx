import { render, screen, fireEvent } from '@testing-library/react';
import ArtistCard from './ArtistCard';
import { useAuthStore } from '../stores/authStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useViewModeStore } from '../stores/viewModeStore';

const artist = { id: 1, name: 'Test Artist', image_path: 'x.jpg' };

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
});

test('shows the album count on desktop', () => {
  render(<ArtistCard artist={{ ...artist, album_count: 5 }} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
  expect(screen.getByText('5 albums')).toBeInTheDocument();
});

test('clicking the desktop card calls onClick with the artist', () => {
  const onClick = vi.fn();
  render(<ArtistCard artist={artist} onClick={onClick} imageUrl="/img/sm/x.jpg" />);
  fireEvent.click(screen.getByText('Test Artist'));
  expect(onClick).toHaveBeenCalledWith(artist);
});

describe('mobile row layout', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
  });

  test('shows "Artist" as the subtitle, without an album count', () => {
    render(<ArtistCard artist={{ ...artist, album_count: 5 }} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    expect(screen.getByText('Artist')).toBeInTheDocument();
    expect(screen.queryByText(/album/)).toBeNull();
  });

  test('does not render a play button', () => {
    render(<ArtistCard artist={artist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('clicking the row calls onClick with the artist', () => {
    const onClick = vi.fn();
    render(<ArtistCard artist={artist} onClick={onClick} imageUrl="/img/sm/x.jpg" />);
    fireEvent.click(screen.getByText('Test Artist'));
    expect(onClick).toHaveBeenCalledWith(artist);
  });
});

describe('desktop list-mode row layout', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    useViewModeStore.setState({ mode: 'list' });
  });

  afterEach(() => {
    useViewModeStore.setState({ mode: 'card' });
  });

  test('shows "Artist" as the subtitle, without an album count', () => {
    render(<ArtistCard artist={{ ...artist, album_count: 5 }} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    expect(screen.getByText('Artist')).toBeInTheDocument();
    expect(screen.queryByText(/5 album/)).toBeNull();
  });

  test('clicking the row calls onClick with the artist', () => {
    const onClick = vi.fn();
    render(<ArtistCard artist={artist} onClick={onClick} imageUrl="/img/sm/x.jpg" />);
    fireEvent.click(screen.getByText('Test Artist'));
    expect(onClick).toHaveBeenCalledWith(artist);
  });
});

describe('ArtistCard — Favorite menu item', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false });
    useFavoritesStore.setState({ isFavorite: () => false, toggleFavorite: vi.fn() });
  });

  test('right-click does nothing when logged out', () => {
    render(<ArtistCard artist={artist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    fireEvent.contextMenu(screen.getByText('Test Artist').closest('.artist-card'));
    expect(screen.queryByText(/Favorites/)).not.toBeInTheDocument();
  });

  test('right-click shows the Favorite item when logged in', () => {
    useAuthStore.setState({ isAuthenticated: true });
    render(<ArtistCard artist={artist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    fireEvent.contextMenu(screen.getByText('Test Artist').closest('.artist-card'));
    expect(screen.getByText('☆ Add to Favorites')).toBeInTheDocument();
  });

  test('clicking it calls toggleFavorite with the artist kind/id', () => {
    useAuthStore.setState({ isAuthenticated: true });
    const toggleFavorite = vi.fn();
    useFavoritesStore.setState({ isFavorite: () => false, toggleFavorite });
    render(<ArtistCard artist={artist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    fireEvent.contextMenu(screen.getByText('Test Artist').closest('.artist-card'));

    fireEvent.click(screen.getByText('☆ Add to Favorites'));

    expect(toggleFavorite).toHaveBeenCalledWith('artist', artist.id, expect.objectContaining({ id: artist.id, name: artist.name }));
  });

  test('shows "Remove from Favorites" when already favorited', () => {
    useAuthStore.setState({ isAuthenticated: true });
    useFavoritesStore.setState({ isFavorite: () => true, toggleFavorite: vi.fn() });
    render(<ArtistCard artist={artist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    fireEvent.contextMenu(screen.getByText('Test Artist').closest('.artist-card'));
    expect(screen.getByText('★ Remove from Favorites')).toBeInTheDocument();
  });
});
