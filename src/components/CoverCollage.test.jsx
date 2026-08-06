import { render, screen, fireEvent } from '@testing-library/react';
import CoverCollage from './CoverCollage';

vi.mock('../services/api', () => ({
  apiService: {
    getImageUrl: (path, context) => (path ? `http://example.com/${context}/${path}` : null),
  },
}));

describe('CoverCollage', () => {
  test('renders the real image when imagePath is set, and it is clickable if onImageClick is passed', () => {
    const onImageClick = vi.fn();
    render(<CoverCollage imagePath="cover.jpg" alt="My Thing" onImageClick={onImageClick} imageContext="album_page" />);

    const img = screen.getByAltText('My Thing');
    expect(img).toHaveAttribute('src', 'http://example.com/album_page/cover.jpg');
    expect(img.style.cursor).toBe('zoom-in');

    fireEvent.click(img);
    expect(onImageClick).toHaveBeenCalled();
  });

  test('real image is not clickable when onImageClick is omitted', () => {
    render(<CoverCollage imagePath="cover.jpg" alt="My Thing" imageContext="album_page" />);
    const img = screen.getByAltText('My Thing');
    expect(img.style.cursor).toBe('');
  });

  test('renders a 2x2 collage of the first 4 items with images when no imagePath and 4+ available', () => {
    render(
      <CoverCollage
        items={[
          { id: 1, image_path: 'a.jpg' },
          { id: 2, image_path: 'b.jpg' },
          { id: 3, image_path: null },
          { id: 4, image_path: 'd.jpg' },
          { id: 5, image_path: 'e.jpg' },
        ]}
        alt="My Thing"
      />
    );
    const collage = screen.getByTestId('cover-collage');
    const tiles = collage.querySelectorAll('img');
    expect(tiles).toHaveLength(4);
    expect(tiles[0]).toHaveAttribute('src', 'http://example.com/album_small/a.jpg');
    expect(tiles[1]).toHaveAttribute('src', 'http://example.com/album_small/b.jpg');
    expect(tiles[2]).toHaveAttribute('src', 'http://example.com/album_small/d.jpg');
    expect(tiles[3]).toHaveAttribute('src', 'http://example.com/album_small/e.jpg');
  });

  test('renders a single cover when 1-3 items have images', () => {
    render(
      <CoverCollage
        items={[
          { id: 1, image_path: 'a.jpg' },
          { id: 2, image_path: null },
        ]}
        alt="My Thing"
      />
    );
    expect(screen.queryByTestId('cover-collage')).not.toBeInTheDocument();
    const cover = screen.getByTestId('cover-collage-single');
    expect(cover).toHaveAttribute('src', 'http://example.com/album_small/a.jpg');
  });

  test('renders the placeholder glyph when no items have images', () => {
    render(<CoverCollage items={[{ id: 1, image_path: null }]} alt="My Thing" placeholderGlyph="♪" />);
    expect(screen.queryByTestId('cover-collage')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cover-collage-single')).not.toBeInTheDocument();
    expect(screen.getByTestId('cover-collage-placeholder')).toHaveTextContent('♪');
  });

  test('defaults to the ▣ placeholder glyph', () => {
    render(<CoverCollage items={[]} alt="My Thing" />);
    expect(screen.getByTestId('cover-collage-placeholder')).toHaveTextContent('▣');
  });
});
