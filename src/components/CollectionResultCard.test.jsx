import { render, screen, fireEvent } from '@testing-library/react';
import CollectionResultCard from './CollectionResultCard';

const collection = { id: 9, name: 'Test Collection' };

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
});

test('renders the collection name', () => {
  render(<CollectionResultCard collection={collection} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
  expect(screen.getByText('Test Collection')).toBeInTheDocument();
});

test('shows the album count when present', () => {
  render(
    <CollectionResultCard
      collection={{ ...collection, album_count: 3 }}
      onClick={vi.fn()}
      imageUrl="/img/sm/x.jpg"
    />
  );
  expect(screen.getByText('3 albums')).toBeInTheDocument();
});

test('does not render an album count when album_count is absent', () => {
  render(<CollectionResultCard collection={collection} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
  expect(screen.queryByText(/album/)).toBeNull();
});

test('clicking the card calls onClick with the collection', () => {
  const onClick = vi.fn();
  render(<CollectionResultCard collection={collection} onClick={onClick} imageUrl="/img/sm/x.jpg" />);
  screen.getByText('Test Collection').click();
  expect(onClick).toHaveBeenCalledWith(collection);
});

describe('mobile row layout', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
  });

  test('shows "Collection · {N} albums" as the subtitle', () => {
    render(
      <CollectionResultCard
        collection={{ ...collection, album_count: 3 }}
        onClick={vi.fn()}
        imageUrl="/img/sm/x.jpg"
      />
    );
    expect(screen.getByText('Collection · 3 albums')).toBeInTheDocument();
  });

  test('shows just "Collection" as the subtitle when album_count is absent', () => {
    render(<CollectionResultCard collection={collection} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    expect(screen.getByText('Collection')).toBeInTheDocument();
  });

  test('does not render a play button', () => {
    render(<CollectionResultCard collection={collection} onClick={vi.fn()} imageUrl="/img/sm/x.jpg" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('clicking the row calls onClick with the collection', () => {
    const onClick = vi.fn();
    render(<CollectionResultCard collection={collection} onClick={onClick} imageUrl="/img/sm/x.jpg" />);
    fireEvent.click(screen.getByText('Test Collection'));
    expect(onClick).toHaveBeenCalledWith(collection);
  });
});
