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

describe('Collection page — cover collage', () => {
  test('shows a 2x2 collage of the first 4 albums with covers when there is no custom image', async () => {
    apiService.getCollection.mockResolvedValue({
      data: {
        collection: baseCollection,
        albums: [
          { id: 1, title: 'A', image_path: 'a.jpg', artist: { id: 1, name: 'Artist A' } },
          { id: 2, title: 'B', image_path: 'b.jpg', artist: { id: 2, name: 'Artist B' } },
          { id: 3, title: 'C', image_path: null, artist: { id: 3, name: 'Artist C' } },
          { id: 4, title: 'D', image_path: 'd.jpg', artist: { id: 4, name: 'Artist D' } },
          { id: 5, title: 'E', image_path: 'e.jpg', artist: { id: 5, name: 'Artist E' } },
        ],
        notes: [],
        summary: null,
      },
    });
    renderCollection();
    await screen.findByText('Road Trip Mix');

    const collage = screen.getByTestId('cover-collage');
    const tiles = collage.querySelectorAll('img');
    expect(tiles).toHaveLength(4);
    expect(tiles[0]).toHaveAttribute('src', 'http://example.com/a.jpg');
    expect(tiles[1]).toHaveAttribute('src', 'http://example.com/b.jpg');
    expect(tiles[2]).toHaveAttribute('src', 'http://example.com/d.jpg');
    expect(tiles[3]).toHaveAttribute('src', 'http://example.com/e.jpg');
  });

  test('shows a single cover when 1-3 albums have images', async () => {
    apiService.getCollection.mockResolvedValue({
      data: {
        collection: baseCollection,
        albums: [
          { id: 1, title: 'A', image_path: 'a.jpg', artist: { id: 1, name: 'Artist A' } },
          { id: 2, title: 'B', image_path: null, artist: { id: 2, name: 'Artist B' } },
        ],
        notes: [],
        summary: null,
      },
    });
    renderCollection();
    await screen.findByText('Road Trip Mix');

    expect(screen.queryByTestId('cover-collage')).not.toBeInTheDocument();
    const cover = screen.getByTestId('cover-collage-single');
    expect(cover).toHaveAttribute('src', 'http://example.com/a.jpg');
  });

  test('shows the placeholder when no album has an image', async () => {
    apiService.getCollection.mockResolvedValue({
      data: {
        collection: baseCollection,
        albums: [{ id: 1, title: 'A', image_path: null, artist: { id: 1, name: 'Artist A' } }],
        notes: [],
        summary: null,
      },
    });
    renderCollection();
    await screen.findByText('Road Trip Mix');

    expect(screen.queryByTestId('cover-collage')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cover-collage-single')).not.toBeInTheDocument();
    expect(screen.getByText('▣')).toBeInTheDocument();
  });

  test('shows the custom image instead of the collage when image_path is set, and it stays clickable', async () => {
    apiService.getCollection.mockResolvedValue({
      data: {
        collection: { ...baseCollection, image_path: 'cover.jpg' },
        albums: [
          { id: 1, title: 'A', image_path: 'a.jpg', artist: { id: 1, name: 'Artist A' } },
          { id: 2, title: 'B', image_path: 'b.jpg', artist: { id: 2, name: 'Artist B' } },
          { id: 3, title: 'C', image_path: 'c.jpg', artist: { id: 3, name: 'Artist C' } },
          { id: 4, title: 'D', image_path: 'd.jpg', artist: { id: 4, name: 'Artist D' } },
          { id: 5, title: 'E', image_path: 'e.jpg', artist: { id: 5, name: 'Artist E' } },
        ],
        notes: [],
        summary: null,
      },
    });
    renderCollection();
    await screen.findByText('Road Trip Mix');

    expect(screen.queryByTestId('cover-collage')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cover-collage-single')).not.toBeInTheDocument();

    const img = screen.getByAltText('Road Trip Mix');
    expect(img).toHaveAttribute('src', 'http://example.com/cover.jpg');
    expect(img.style.cursor).toBe('zoom-in');
  });
});
