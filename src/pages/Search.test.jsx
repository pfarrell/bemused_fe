import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
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
