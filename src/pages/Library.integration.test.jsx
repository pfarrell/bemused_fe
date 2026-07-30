// src/pages/Library.integration.test.jsx
//
// Every other favorites-related component test mocks useFavoritesStore
// directly (setState({ isFavorite: () => ..., toggleFavorite: vi.fn() })),
// so the real store's reactivity — does a card actually disappear after a
// real toggleFavorite() call flows through the store's optimistic update
// and back out through Library's reactive filter — is never exercised.
// This test uses the real favoritesStore, mocking only the network layer.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Library from './Library';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';

vi.mock('../services/api', () => ({
  apiService: {
    getImageUrl: () => 'http://example.com/image.jpg',
    getFavorites: vi.fn(),
    removeFavorite: vi.fn(),
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
  // Real favoritesStore (not mocked), reset to a known starting state: one
  // favorited artist, already loaded so the mount effect's load() call is a
  // no-op in practice.
  useFavoritesStore.setState({
    items: [{ id: 1, kind: 'artist', target_id: 5, item: { id: 5, name: 'Test Artist', image_path: null } }],
    loading: false,
    loaded: true,
  });
  vi.clearAllMocks();
  apiService.getFavorites.mockResolvedValue({ data: [] });
  apiService.removeFavorite.mockResolvedValue({ data: { success: true } });
});

test('right-clicking an artist card and choosing Remove from Favorites removes it from the DOM', async () => {
  renderLibrary();
  expect(screen.getByText('Test Artist')).toBeInTheDocument();

  fireEvent.contextMenu(screen.getByText('Test Artist').closest('.artist-card'));
  const removeButton = await screen.findByText('★ Remove from Favorites');
  fireEvent.click(removeButton);

  await waitFor(() => {
    expect(screen.queryByText('Test Artist')).not.toBeInTheDocument();
  });
  expect(apiService.removeFavorite).toHaveBeenCalledWith('artist', 5);
  expect(screen.getByText('No favorite artists yet.')).toBeInTheDocument();
});
