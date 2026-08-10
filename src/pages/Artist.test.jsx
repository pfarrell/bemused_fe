import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Artist from './Artist';
import { useAuthStore } from '../stores/authStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { apiService } from '../services/api';

vi.mock('../components/TagsSection', () => ({ default: () => null }));
vi.mock('../components/AddToCollectionModal', () => ({ default: () => null }));
vi.mock('../services/api', () => ({
  apiService: {
    getArtist: vi.fn(),
    getImageUrl: () => 'http://example.com/image.jpg',
  },
}));

const artistData = {
  artist: { id: 1, name: 'Test Artist', image_path: 'a.jpg' },
  summary: {},
  singles: [],
  appears_on: [],
  related_artists: [],
  members: [],
  member_of: [],
  similar_artists: [],
};

const renderArtist = () =>
  render(
    <MemoryRouter initialEntries={['/artist/1']}>
      <Routes>
        <Route path="/artist/:id" element={<Artist />} />
      </Routes>
    </MemoryRouter>
  );

const album = (id, title, release_year) => ({
  id,
  title,
  release_year,
  image_path: `${id}.jpg`,
  artist: { id: 1, name: 'Test Artist' },
  track_count: 10,
});

beforeEach(() => {
  useAuthStore.setState({ isAdmin: false, isAuthenticated: true });
  useFavoritesStore.setState({ isFavorite: () => false, toggleFavorite: vi.fn() });
});

describe('Artist page — dated/undated album divider', () => {
  test('renders a divider once when the album list mixes dated and undated albums', async () => {
    apiService.getArtist.mockResolvedValue({
      data: {
        ...artistData,
        albums: [
          album(1, 'Dated Two', '1975'),
          album(2, 'Dated One', '1970'),
          album(3, 'Undated A', null),
          album(4, 'Undated B', null),
        ],
      },
    });

    renderArtist();
    await screen.findByText('Dated Two');

    expect(document.querySelectorAll('.album-year-divider')).toHaveLength(1);
  });

  test('does not render a divider when every album has a year', async () => {
    apiService.getArtist.mockResolvedValue({
      data: {
        ...artistData,
        albums: [album(1, 'Dated Two', '1975'), album(2, 'Dated One', '1970')],
      },
    });

    renderArtist();
    await screen.findByText('Dated Two');

    expect(document.querySelectorAll('.album-year-divider')).toHaveLength(0);
  });

  test('does not render a divider when no album has a year', async () => {
    apiService.getArtist.mockResolvedValue({
      data: {
        ...artistData,
        albums: [album(1, 'Undated A', null), album(2, 'Undated B', '0')],
      },
    });

    renderArtist();
    await screen.findByText('Undated A');

    expect(document.querySelectorAll('.album-year-divider')).toHaveLength(0);
  });

  test('does not render a divider for a single-album list', async () => {
    apiService.getArtist.mockResolvedValue({
      data: {
        ...artistData,
        albums: [album(1, 'Only Album', null)],
      },
    });

    renderArtist();
    await screen.findByText('Only Album');

    expect(document.querySelectorAll('.album-year-divider')).toHaveLength(0);
  });
});
