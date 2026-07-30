import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Library from './Library';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useAuthStore } from '../stores/authStore';

vi.mock('../services/api', () => ({
  apiService: {
    getImageUrl: () => 'http://example.com/image.jpg',
  },
}));

const renderLibrary = () =>
  render(
    <MemoryRouter>
      <Library />
    </MemoryRouter>
  );

beforeEach(() => {
  useAuthStore.setState({ isAuthenticated: true });
  useFavoritesStore.setState({
    items: [],
    loading: false,
    loaded: true,
    load: vi.fn(),
  });
});

test('shows an empty state for the default (Artists) tab when there are no favorites', () => {
  renderLibrary();
  expect(screen.getByText('No favorite artists yet.')).toBeInTheDocument();
});

test('renders a favorited artist on the Artists tab', () => {
  useFavoritesStore.setState({
    items: [{ id: 1, kind: 'artist', target_id: 5, item: { id: 5, name: 'Test Artist', image_path: null } }],
    loading: false,
    loaded: true,
    load: vi.fn(),
  });
  renderLibrary();
  expect(screen.getByText('Test Artist')).toBeInTheDocument();
});

test('switching to the Albums tab shows favorited albums and hides artists', () => {
  useFavoritesStore.setState({
    items: [
      { id: 1, kind: 'artist', target_id: 5, item: { id: 5, name: 'Test Artist', image_path: null } },
      { id: 2, kind: 'album', target_id: 8, item: { id: 8, title: 'Test Album', image_path: null, artist: { id: 5, name: 'Test Artist' } } },
    ],
    loading: false,
    loaded: true,
    load: vi.fn(),
  });
  renderLibrary();

  fireEvent.click(screen.getByText('Albums'));

  expect(screen.getByText('Test Album')).toBeInTheDocument();
  expect(screen.queryByText('No favorite')).not.toBeInTheDocument();
});

test('a favorite whose target row was deleted (item: null) is skipped, not rendered as an error', () => {
  useFavoritesStore.setState({
    items: [{ id: 1, kind: 'artist', target_id: 999, item: null }],
    loading: false,
    loaded: true,
    load: vi.fn(),
  });
  renderLibrary();
  expect(screen.getByText('No favorite artists yet.')).toBeInTheDocument();
});

test('calls load() on mount when favorites have not been loaded yet', () => {
  const load = vi.fn();
  useFavoritesStore.setState({ items: [], loading: false, loaded: false, load });
  renderLibrary();
  expect(load).toHaveBeenCalled();
});
