import { render, screen, fireEvent } from '@testing-library/react';
import SearchTypeFilterPills from './SearchTypeFilterPills';

const results = [
  { type: 'album', data: { id: 1 } },
  { type: 'album', data: { id: 2 } },
  { type: 'artist', data: { id: 3 } },
];

test('renders one pill per type present, each labeled with its count', () => {
  render(<SearchTypeFilterPills results={results} activeTypes={new Set()} onToggle={vi.fn()} />);
  expect(screen.getByText('Albums 2')).toBeInTheDocument();
  expect(screen.getByText('Artists 1')).toBeInTheDocument();
});

test('does not render a pill for a type with zero results', () => {
  render(<SearchTypeFilterPills results={results} activeTypes={new Set()} onToggle={vi.fn()} />);
  expect(screen.queryByText(/Playlists/)).toBeNull();
  expect(screen.queryByText(/Collections/)).toBeNull();
});

test('renders nothing when results is empty', () => {
  const { container } = render(<SearchTypeFilterPills results={[]} activeTypes={new Set()} onToggle={vi.fn()} />);
  expect(container).toBeEmptyDOMElement();
});

test('applies the active class to a pill in activeTypes', () => {
  render(<SearchTypeFilterPills results={results} activeTypes={new Set(['album'])} onToggle={vi.fn()} />);
  expect(screen.getByText('Albums 2')).toHaveClass('active');
  expect(screen.getByText('Artists 1')).not.toHaveClass('active');
});

test('clicking a pill calls onToggle with that type', () => {
  const onToggle = vi.fn();
  render(<SearchTypeFilterPills results={results} activeTypes={new Set()} onToggle={onToggle} />);
  fireEvent.click(screen.getByText('Albums 2'));
  expect(onToggle).toHaveBeenCalledWith('album');
});
