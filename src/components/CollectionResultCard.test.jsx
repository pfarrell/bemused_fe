import { render, screen, fireEvent } from '@testing-library/react';
import CollectionResultCard from './CollectionResultCard';
import { useAuthStore } from '../stores/authStore';
import { useFavoritesStore } from '../stores/favoritesStore';

const collection = { id: 9, name: 'Test Collection' };

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
});

test('renders the collection name', () => {
  render(<CollectionResultCard collection={collection} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
  expect(screen.getByText('Test Collection')).toBeInTheDocument();
});

test('shows the album count when present', () => {
  render(
    <CollectionResultCard
      collection={{ ...collection, album_count: 3 }}
      onClick={vi.fn()}
      imageUrl="/img/sm/x.jpg"
    />
  );
  expect(screen.getByText('3 albums')).toBeInTheDocument();
});

test('does not render an album count when album_count is absent', () => {
  render(<CollectionResultCard collection={collection} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
  expect(screen.queryByText(/album/)).toBeNull();
});

test('clicking the card calls onClick with the collection', () => {
  const onClick = vi.fn();
  render(<CollectionResultCard collection={collection} onClick={onClick} imageUrl="/img/sm/x.jpg" />);
  screen.getByText('Test Collection').click();
  expect(onClick).toHaveBeenCalledWith(collection);
});

describe('mobile row layout', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
  });

  test('shows "Collection · {N} albums" as the subtitle', () => {
    render(
      <CollectionResultCard
        collection={{ ...collection, album_count: 3 }}
        onClick={vi.fn()}
        imageUrl="/img/sm/x.jpg"
      />
    );
    expect(screen.getByText('Collection · 3 albums')).toBeInTheDocument();
  });

  test('shows just "Collection" as the subtitle when album_count is absent', () => {
    render(<CollectionResultCard collection={collection} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    expect(screen.getByText('Collection')).toBeInTheDocument();
  });

  test('does not render a play button', () => {
    render(<CollectionResultCard collection={collection} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('clicking the row calls onClick with the collection', () => {
    const onClick = vi.fn();
    render(<CollectionResultCard collection={collection} onClick={onClick} imageUrl="/img/sm/x.jpg" />);
    fireEvent.click(screen.getByText('Test Collection'));
    expect(onClick).toHaveBeenCalledWith(collection);
  });
});

describe('CollectionResultCard — Favorite menu item', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false });
    useFavoritesStore.setState({ isFavorite: () => false, toggleFavorite: vi.fn() });
  });

  test('right-click does nothing when logged out', () => {
    render(<CollectionResultCard collection={collection} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    fireEvent.contextMenu(screen.getByText('Test Collection').closest('.artist-card'));
    expect(screen.queryByText(/Favorites/)).not.toBeInTheDocument();
  });

  test('right-click shows the Favorite item when logged in', () => {
    useAuthStore.setState({ isAuthenticated: true });
    render(<CollectionResultCard collection={collection} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    fireEvent.contextMenu(screen.getByText('Test Collection').closest('.artist-card'));
    expect(screen.getByText('☆ Add to Favorites')).toBeInTheDocument();
  });

  test('clicking it calls toggleFavorite with the collection kind/id', () => {
    useAuthStore.setState({ isAuthenticated: true });
    const toggleFavorite = vi.fn();
    useFavoritesStore.setState({ isFavorite: () => false, toggleFavorite });
    render(<CollectionResultCard collection={collection} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    fireEvent.contextMenu(screen.getByText('Test Collection').closest('.artist-card'));

    fireEvent.click(screen.getByText('☆ Add to Favorites'));

    expect(toggleFavorite).toHaveBeenCalledWith('collection', collection.id, expect.objectContaining({ id: collection.id, name: collection.name }));
  });
});
