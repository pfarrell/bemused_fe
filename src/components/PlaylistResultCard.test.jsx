import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlaylistResultCard from './PlaylistResultCard';
import { apiService } from '../services/api';
import { usePlayerStore } from '../stores/playerStore';

vi.mock('../services/api', () => ({
  apiService: {
    getPlaylist: vi.fn(),
  },
}));

const playlist = { id: 5, name: 'Test Playlist' };

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
});

test('renders the playlist name', () => {
  render(<PlaylistResultCard playlist={playlist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
  expect(screen.getByText('Test Playlist')).toBeInTheDocument();
});

test('shows the track count when present', () => {
  render(
    <PlaylistResultCard
      playlist={{ ...playlist, track_count: 8 }}
      onClick={vi.fn()}
      imageUrl="/img/sm/x.jpg"
    />
  );
  expect(screen.getByText('8 tracks')).toBeInTheDocument();
});

test('does not render a track count when track_count is absent', () => {
  render(<PlaylistResultCard playlist={playlist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
  expect(screen.queryByText(/track/)).toBeNull();
});

test('clicking the card calls onClick with the playlist', () => {
  const onClick = vi.fn();
  render(<PlaylistResultCard playlist={playlist} onClick={onClick} imageUrl="/img/sm/x.jpg" />);
  screen.getByText('Test Playlist').click();
  expect(onClick).toHaveBeenCalledWith(playlist);
});

describe('mobile row layout', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
  });

  test('shows "Playlist · {N} tracks" as the subtitle', () => {
    render(
      <PlaylistResultCard
        playlist={{ ...playlist, track_count: 8 }}
        onClick={vi.fn()}
        imageUrl="/img/sm/x.jpg"
      />
    );
    expect(screen.getByText('Playlist · 8 tracks')).toBeInTheDocument();
  });

  test('shows just "Playlist" as the subtitle when track_count is absent', () => {
    render(<PlaylistResultCard playlist={playlist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    expect(screen.getByText('Playlist')).toBeInTheDocument();
  });

  test('tapping play fetches the playlist, replaces the queue, and does not navigate', async () => {
    apiService.getPlaylist.mockResolvedValue({
      data: { tracks: [{ id: 1, title: 'Track One', url: 'http://x/1.mp3' }] },
    });
    const clearPlaylist = vi.fn();
    const addTracks = vi.fn();
    usePlayerStore.setState({ clearPlaylist, addTracks });
    const onClick = vi.fn();

    render(<PlaylistResultCard playlist={playlist} onClick={onClick} imageUrl="/img/sm/x.jpg" />);

    fireEvent.click(screen.getByRole('button', { name: 'Play Test Playlist' }));

    await waitFor(() => expect(addTracks).toHaveBeenCalled());

    expect(apiService.getPlaylist).toHaveBeenCalledWith(5);
    expect(clearPlaylist).toHaveBeenCalled();
    expect(addTracks).toHaveBeenCalledWith([{ id: 1, title: 'Track One', url: 'http://x/1.mp3' }]);
    expect(onClick).not.toHaveBeenCalled();
  });
});
