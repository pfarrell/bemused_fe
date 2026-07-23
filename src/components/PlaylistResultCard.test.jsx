import { render, screen } from '@testing-library/react';
import PlaylistResultCard from './PlaylistResultCard';

const playlist = { id: 5, name: 'Test Playlist' };

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
