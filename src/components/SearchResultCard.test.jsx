import { render, screen, fireEvent } from '@testing-library/react';
import SearchResultCard from './SearchResultCard';
import { useNavigate, useLocation } from 'react-router-dom';

vi.mock('./AddToCollectionModal', () => ({ default: () => null }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: vi.fn(), useLocation: vi.fn() };
});

beforeEach(() => {
  useNavigate.mockReturnValue(vi.fn());
  useLocation.mockReturnValue({ pathname: '/' });
});

const getImageUrl = () => '/img/sm/x.jpg';

test('renders an AlbumCard with an ALBUM badge for type "album"', () => {
  render(
    <SearchResultCard
      type="album"
      data={{ id: 1, title: 'Test Album', image_path: 'x.jpg', artist: { id: 2, name: 'Test Artist' } }}
      onNavigate={vi.fn()}
      getImageUrl={getImageUrl}
    />
  );
  expect(screen.getByText('Test Album')).toBeInTheDocument();
  expect(screen.getByText('ALBUM')).toBeInTheDocument();
});

test('renders an ArtistCard with an ARTIST badge for type "artist"', () => {
  render(
    <SearchResultCard
      type="artist"
      data={{ id: 2, name: 'Test Artist', image_path: 'x.jpg' }}
      onNavigate={vi.fn()}
      getImageUrl={getImageUrl}
    />
  );
  expect(screen.getByText('Test Artist')).toBeInTheDocument();
  expect(screen.getByText('ARTIST')).toBeInTheDocument();
});

test('renders a PlaylistResultCard with a PLAYLIST badge for type "playlist"', () => {
  render(
    <SearchResultCard
      type="playlist"
      data={{ id: 3, name: 'Test Playlist', image_path: 'x.jpg' }}
      onNavigate={vi.fn()}
      getImageUrl={getImageUrl}
    />
  );
  expect(screen.getByText('Test Playlist')).toBeInTheDocument();
  expect(screen.getByText('PLAYLIST')).toBeInTheDocument();
});

test('renders a CollectionResultCard with a COLLECTION badge for type "collection"', () => {
  render(
    <SearchResultCard
      type="collection"
      data={{ id: 4, name: 'Test Collection', image_path: 'x.jpg' }}
      onNavigate={vi.fn()}
      getImageUrl={getImageUrl}
    />
  );
  expect(screen.getByText('Test Collection')).toBeInTheDocument();
  expect(screen.getByText('COLLECTION')).toBeInTheDocument();
});

test('clicking an album card calls onNavigate with the album route', () => {
  const onNavigate = vi.fn();
  render(
    <SearchResultCard
      type="album"
      data={{ id: 1, title: 'Test Album', image_path: 'x.jpg', artist: { id: 2, name: 'Test Artist' } }}
      onNavigate={onNavigate}
      getImageUrl={getImageUrl}
    />
  );
  fireEvent.click(screen.getByText('Test Album'));
  expect(onNavigate).toHaveBeenCalledWith('/album/1');
});

test('clicking a playlist card calls onNavigate with the playlist route', () => {
  const onNavigate = vi.fn();
  render(
    <SearchResultCard
      type="playlist"
      data={{ id: 3, name: 'Test Playlist', image_path: 'x.jpg' }}
      onNavigate={onNavigate}
      getImageUrl={getImageUrl}
    />
  );
  fireEvent.click(screen.getByText('Test Playlist'));
  expect(onNavigate).toHaveBeenCalledWith('/playlist/3');
});
