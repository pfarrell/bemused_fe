import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Collection from './Collection';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useFavoritesStore } from '../stores/favoritesStore';

vi.mock('../components/NotesSection', () => ({ default: () => null }));
vi.mock('../components/AlbumCard', () => ({ default: ({ album }) => <div>{album.title}</div> }));
vi.mock('../services/api', () => ({
  apiService: {
    getCollection: vi.fn(),
    getImageUrl: (path) => (path ? `http://example.com/${path}` : null),
  },
}));

const baseCollection = { id: 3, name: 'Road Trip Mix', image_path: null, user_id: null };

const renderCollection = () =>
  render(
    <MemoryRouter initialEntries={['/collection/3']}>
      <Routes>
        <Route path="/collection/:id" element={<Collection />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ isAdmin: false, isAuthenticated: false, user: null });
  useFavoritesStore.setState({ isFavorite: () => false, toggleFavorite: vi.fn() });
});

describe('Collection page — wikipedia summary', () => {
  test('renders the summary when present', async () => {
    apiService.getCollection.mockResolvedValue({
      data: {
        collection: baseCollection,
        albums: [],
        notes: [],
        summary: { summary: 'A famous mix tape.', url: 'https://en.wikipedia.org/wiki/Kind_of_Blue' },
      },
    });
    renderCollection();
    expect(await screen.findByText(/A famous mix tape\./)).toBeInTheDocument();
  });

  test('renders nothing extra when summary is null', async () => {
    apiService.getCollection.mockResolvedValue({
      data: { collection: baseCollection, albums: [], notes: [], summary: null },
    });
    renderCollection();
    await screen.findByText('Road Trip Mix');
    expect(screen.queryByText(/\.\.\.more at wikipedia/)).not.toBeInTheDocument();
  });
});
