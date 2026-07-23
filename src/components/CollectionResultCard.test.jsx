import { render, screen } from '@testing-library/react';
import CollectionResultCard from './CollectionResultCard';

const collection = { id: 9, name: 'Test Collection' };

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
