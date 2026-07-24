import { render, screen, fireEvent } from '@testing-library/react';
import ArtistCard from './ArtistCard';

const artist = { id: 1, name: 'Test Artist', image_path: 'x.jpg' };

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
});

test('shows the album count on desktop', () => {
  render(<ArtistCard artist={{ ...artist, album_count: 5 }} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
  expect(screen.getByText('5 albums')).toBeInTheDocument();
});

test('clicking the desktop card calls onClick with the artist', () => {
  const onClick = vi.fn();
  render(<ArtistCard artist={artist} onClick={onClick} imageUrl="/img/sm/x.jpg" />);
  fireEvent.click(screen.getByText('Test Artist'));
  expect(onClick).toHaveBeenCalledWith(artist);
});

describe('mobile row layout', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
  });

  test('shows "Artist" as the subtitle, without an album count', () => {
    render(<ArtistCard artist={{ ...artist, album_count: 5 }} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    expect(screen.getByText('Artist')).toBeInTheDocument();
    expect(screen.queryByText(/album/)).toBeNull();
  });

  test('does not render a play button', () => {
    render(<ArtistCard artist={artist} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('clicking the row calls onClick with the artist', () => {
    const onClick = vi.fn();
    render(<ArtistCard artist={artist} onClick={onClick} imageUrl="/img/sm/x.jpg" />);
    fireEvent.click(screen.getByText('Test Artist'));
    expect(onClick).toHaveBeenCalledWith(artist);
  });
});
