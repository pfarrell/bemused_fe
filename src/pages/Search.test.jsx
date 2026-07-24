import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Search from './Search';
import { apiService } from '../services/api';

vi.mock('../services/api', () => ({
  apiService: {
    search: vi.fn(),
    getImageUrl: () => '/img/sm/x.jpg',
  },
}));

vi.mock('../components/AddToCollectionModal', () => ({ default: () => null }));

const renderSearch = (q) =>
  render(
    <MemoryRouter initialEntries={[`/search?q=${q}`]}>
      <Routes>
        <Route path="/search" element={<Search />} />
      </Routes>
    </MemoryRouter>
  );

test('renders mixed-type results in the order the API returned', async () => {
  apiService.search.mockResolvedValue({
    data: {
      results: [
        { type: 'artist', data: { id: 1, name: 'Ranked Artist', image_path: 'a.jpg' } },
        { type: 'album', data: { id: 2, title: 'Ranked Album', image_path: 'b.jpg', artist: { id: 3, name: 'Other Artist' } } },
      ],
      tracks: [],
      count: 2,
    },
  });

  renderSearch('ranked');

  await screen.findByText('Ranked Artist');
  // Distinct artist names (rather than reusing "Ranked Artist" for both the
  // artist card and the album's artist subtitle) avoid a duplicate-text match
  // on getByText, and asserting heading order actually verifies the API's
  // ranking order made it to the DOM instead of just checking presence.
  const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
  expect(headings).toEqual(['Ranked Artist', 'Ranked Album']);
  expect(screen.getByText('ARTIST')).toBeInTheDocument();
  expect(screen.getByText('ALBUM')).toBeInTheDocument();
});

test('renders tracks in their own section, separate from the ranked results', async () => {
  apiService.search.mockResolvedValue({
    data: {
      results: [],
      tracks: [{ id: 9, title: 'Some Track', duration: 180, artist: { name: 'Some Artist' } }],
      count: 1,
    },
  });

  renderSearch('track');

  expect(await screen.findByText(/Some Track/)).toBeInTheDocument();
  expect(screen.getByText('Tracks (1)')).toBeInTheDocument();
});

test('shows a no-results message when both results and tracks are empty', async () => {
  apiService.search.mockResolvedValue({ data: { results: [], tracks: [], count: 0 } });

  renderSearch('nothing');

  expect(await screen.findByText('No results found for "nothing"')).toBeInTheDocument();
});

test('renders a pill per type present, filters the grid when a pill is toggled, and shows everything again when toggled off', async () => {
  apiService.search.mockResolvedValue({
    data: {
      results: [
        { type: 'artist', data: { id: 1, name: 'Only Artist', image_path: 'a.jpg' } },
        { type: 'album', data: { id: 2, title: 'Only Album', image_path: 'b.jpg', artist: { id: 3, name: 'Other Artist' } } },
      ],
      tracks: [],
      count: 2,
    },
  });

  renderSearch('mixed');
  await screen.findByText('Only Artist');

  expect(screen.getByText('Albums 1')).toBeInTheDocument();
  expect(screen.getByText('Artists 1')).toBeInTheDocument();

  fireEvent.click(screen.getByText('Albums 1'));

  expect(screen.getByText('Only Album')).toBeInTheDocument();
  expect(screen.queryByText('Only Artist')).toBeNull();
  expect(screen.getByText('Results (1)')).toBeInTheDocument();

  fireEvent.click(screen.getByText('Albums 1'));

  expect(screen.getByText('Only Artist')).toBeInTheDocument();
  expect(screen.getByText('Only Album')).toBeInTheDocument();
});

test('resets the active type filter when a new search query is submitted', async () => {
  apiService.search.mockResolvedValueOnce({
    data: {
      results: [
        { type: 'artist', data: { id: 1, name: 'First Artist', image_path: 'a.jpg' } },
        { type: 'album', data: { id: 2, title: 'First Album', image_path: 'b.jpg', artist: { id: 3, name: 'Other Artist' } } },
      ],
      tracks: [],
      count: 2,
    },
  });

  const SearchWithNavHelper = () => {
    const navigate = useNavigate();
    return (
      <>
        <button onClick={() => navigate('/search?q=second')}>go to second search</button>
        <Search />
      </>
    );
  };

  render(
    <MemoryRouter initialEntries={['/search?q=first']}>
      <Routes>
        <Route path="/search" element={<SearchWithNavHelper />} />
      </Routes>
    </MemoryRouter>
  );

  await screen.findByText('First Artist');
  fireEvent.click(screen.getByText('Albums 1'));
  expect(screen.queryByText('First Artist')).toBeNull();

  apiService.search.mockResolvedValueOnce({
    data: {
      results: [
        { type: 'artist', data: { id: 4, name: 'Second Artist', image_path: 'a.jpg' } },
      ],
      tracks: [],
      count: 1,
    },
  });

  fireEvent.click(screen.getByText('go to second search'));

  expect(await screen.findByText('Second Artist')).toBeInTheDocument();
});
