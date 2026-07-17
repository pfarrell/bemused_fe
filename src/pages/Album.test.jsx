import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Album from './Album';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';

vi.mock('../components/TagsSection', () => ({ default: () => null }));
vi.mock('../services/api', () => ({
  apiService: {
    getAlbum: vi.fn(),
    getImageUrl: () => 'http://example.com/image.jpg',
  },
}));

const albumData = {
  artist: { id: 5, name: 'Album Artist' },
  album: { id: 10, title: 'Test Album', image_path: 'a.jpg' },
  tracks: [
    { id: 1, title: 'Track One', duration: 180, artist: { name: 'Album Artist' }, album: { id: 10, title: 'Test Album', artist: { id: 5, name: 'Album Artist' } } },
    { id: 2, title: 'Track Two', duration: 200, artist: { name: 'Album Artist' }, album: { id: 10, title: 'Test Album', artist: { id: 5, name: 'Album Artist' } } },
  ],
  summary: {},
  secondary_artists: [],
};

const renderAlbum = () =>
  render(
    <MemoryRouter initialEntries={['/album/10']}>
      <Routes>
        <Route path="/album/:id" element={<Album />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  apiService.getAlbum.mockResolvedValue({ data: albumData });
  useAuthStore.setState({ isAdmin: false, isAuthenticated: true });
});

describe('Album page', () => {
  test('Add to Queue calls addTracks with flashActivity', async () => {
    const addTracks = vi.fn();
    usePlayerStore.setState({ addTracks, currentTrack: null });

    renderAlbum();
    await screen.findByText('Test Album');

    fireEvent.click(screen.getByText('Add to Queue'));

    expect(addTracks).toHaveBeenCalledWith(albumData.tracks, false, { flashActivity: true });
  });

  test('registers the album tracks as pageTracks once loaded, so the footer play button can fall back to them', async () => {
    renderAlbum();
    await screen.findByText('Test Album');

    expect(usePlayerStore.getState().pageTracks).toEqual(albumData.tracks);
  });

  test('clears pageTracks on unmount so a stale album cannot be played from elsewhere', async () => {
    const { unmount } = renderAlbum();
    await screen.findByText('Test Album');

    unmount();

    expect(usePlayerStore.getState().pageTracks).toEqual([]);
  });
});

describe('Album page — compilation secondary-artist suppression', () => {
  const baseData = {
    artist: { id: 5, name: 'Album Artist' },
    tracks: albumData.tracks,
    summary: {},
    secondary_artists: [{ id: 8, name: 'Featured Artist', role: 'featured' }],
  };

  test('shows "Also featuring" when album is not a compilation', async () => {
    apiService.getAlbum.mockResolvedValue({
      data: { ...baseData, album: { id: 10, title: 'Test Album', image_path: 'a.jpg', is_compilation: false } },
    });
    renderAlbum();
    await screen.findByText('Test Album');
    expect(screen.getByText(/Also featuring/)).toBeInTheDocument();
  });

  test('hides "Also featuring" when album is a compilation with no other credited artists', async () => {
    apiService.getAlbum.mockResolvedValue({
      data: { ...baseData, album: { id: 10, title: 'Test Album', image_path: 'a.jpg', is_compilation: true }, compilation_artists: [] },
    });
    renderAlbum();
    await screen.findByText('Test Album');
    expect(screen.queryByText(/Also featuring/)).not.toBeInTheDocument();
  });

  test('shows "Featuring" (not "Also featuring") with track-level artists when album is a compilation', async () => {
    apiService.getAlbum.mockResolvedValue({
      data: {
        ...baseData,
        album: { id: 10, title: 'Test Album', image_path: 'a.jpg', is_compilation: true },
        compilation_artists: [{ id: 200, name: 'Steppenwolf' }, { id: 201, name: 'The Byrds' }],
      },
    });
    renderAlbum();
    await screen.findByText('Test Album');
    expect(screen.getByText('Featuring:')).toBeInTheDocument();
    expect(screen.queryByText(/Also featuring/)).not.toBeInTheDocument();
    expect(screen.getByText('Steppenwolf')).toBeInTheDocument();
    expect(screen.getByText('The Byrds')).toBeInTheDocument();
  });
});

describe('Album page — compilation artist heading', () => {
  test('keeps the album\'s own artist (e.g. Various Artists) as the heading for a compilation album', async () => {
    apiService.getAlbum.mockResolvedValue({
      data: {
        ...albumData,
        album: { ...albumData.album, is_compilation: true },
        compilation_artists: [{ id: 200, name: 'Steppenwolf' }, { id: 201, name: 'The Byrds' }],
      },
    });
    renderAlbum();
    await screen.findByText('Test Album');
    expect(screen.getByText('Album Artist')).toBeInTheDocument();
    expect(screen.getByText('Steppenwolf')).toBeInTheDocument();
    expect(screen.getByText('The Byrds')).toBeInTheDocument();
  });

  test('renders the normal artist heading for a non-compilation album', async () => {
    apiService.getAlbum.mockResolvedValue({ data: albumData });
    renderAlbum();
    await screen.findByText('Test Album');
    expect(screen.getByText('Album Artist')).toBeInTheDocument();
  });
});

describe('Album page — collaborators in the artist heading', () => {
  test('lists collaborator-role artists alongside the primary artist in the heading, not in "Also featuring"', async () => {
    apiService.getAlbum.mockResolvedValue({
      data: {
        artist: { id: 5, name: 'Elton John' },
        album: { id: 10, title: 'Test Album', image_path: 'a.jpg', is_compilation: false },
        tracks: albumData.tracks,
        summary: {},
        secondary_artists: [{ id: 9, name: 'Leon Russell', role: 'collaborator' }],
      },
    });
    renderAlbum();
    await screen.findByText('Test Album');
    expect(screen.getByText('Elton John')).toBeInTheDocument();
    expect(screen.getByText('Leon Russell')).toBeInTheDocument();
    expect(screen.queryByText(/Also featuring/)).not.toBeInTheDocument();
  });
});
