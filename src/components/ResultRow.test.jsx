import { render, screen, fireEvent } from '@testing-library/react';
import ResultRow from './ResultRow';

test('renders the title and subtitle', () => {
  render(<ResultRow imageUrl="/x.jpg" title="Test Title" subtitle="Album · Test Artist" onClick={vi.fn()} />);
  expect(screen.getByText('Test Title')).toBeInTheDocument();
  expect(screen.getByText('Album · Test Artist')).toBeInTheDocument();
});

test('does not render a subtitle element when subtitle is not provided', () => {
  render(<ResultRow imageUrl="/x.jpg" title="Test Title" onClick={vi.fn()} />);
  expect(screen.queryByText(/·/)).toBeNull();
});

test('applies the circle image class when imageShape is "circle"', () => {
  render(<ResultRow imageUrl="/x.jpg" imageShape="circle" title="Test Title" onClick={vi.fn()} />);
  expect(document.querySelector('.result-row-image-circle')).not.toBeNull();
});

test('clicking the row fires onClick', () => {
  const onClick = vi.fn();
  render(<ResultRow imageUrl="/x.jpg" title="Test Title" onClick={onClick} />);
  fireEvent.click(screen.getByText('Test Title'));
  expect(onClick).toHaveBeenCalled();
});

test('does not render a play button when the play prop is absent', () => {
  render(<ResultRow imageUrl="/x.jpg" title="Test Title" onClick={vi.fn()} />);
  expect(screen.queryByRole('button')).toBeNull();
});

test('renders a play button and fires onPlay without firing onClick', () => {
  const onClick = vi.fn();
  const onPlay = vi.fn();
  render(
    <ResultRow
      imageUrl="/x.jpg"
      title="Test Title"
      onClick={onClick}
      play={{ loading: false, onPlay, label: 'Play Test Title' }}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Play Test Title' }));
  expect(onPlay).toHaveBeenCalled();
  expect(onClick).not.toHaveBeenCalled();
});

test('play button is disabled while loading and does not call onPlay', () => {
  const onPlay = vi.fn();
  render(
    <ResultRow
      imageUrl="/x.jpg"
      title="Test Title"
      onClick={vi.fn()}
      play={{ loading: true, onPlay, label: 'Play Test Title' }}
    />
  );
  const button = screen.getByRole('button', { name: 'Play Test Title' });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(onPlay).not.toHaveBeenCalled();
});

test('the play button carries a data-result-row-play marker so callers can guard other handlers against it', () => {
  render(
    <ResultRow
      imageUrl="/x.jpg"
      title="Test Title"
      onClick={vi.fn()}
      play={{ loading: false, onPlay: vi.fn(), label: 'Play Test Title' }}
    />
  );
  expect(screen.getByRole('button', { name: 'Play Test Title' })).toHaveAttribute('data-result-row-play', 'true');
});
