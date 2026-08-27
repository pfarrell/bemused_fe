import { render, screen, fireEvent } from '@testing-library/react';
import PlaylistSortToggle from './PlaylistSortToggle';
import { usePlaylistSortStore } from '../stores/playlistSortStore';

beforeEach(() => {
  usePlaylistSortStore.setState({ sortBy: 'recent' });
});

describe('PlaylistSortToggle', () => {
  test('renders a Recent button and an A–Z button', () => {
    render(<PlaylistSortToggle />);
    expect(screen.getByLabelText('Sort by recently updated')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort alphabetically')).toBeInTheDocument();
  });

  test('Recent is pressed by default', () => {
    render(<PlaylistSortToggle />);
    expect(screen.getByLabelText('Sort by recently updated')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Sort alphabetically')).toHaveAttribute('aria-pressed', 'false');
  });

  test('clicking A–Z switches the store sortBy to alpha', () => {
    render(<PlaylistSortToggle />);
    fireEvent.click(screen.getByLabelText('Sort alphabetically'));
    expect(usePlaylistSortStore.getState().sortBy).toBe('alpha');
  });

  test('reflects alpha sort as pressed once the store is in alpha mode', () => {
    usePlaylistSortStore.setState({ sortBy: 'alpha' });
    render(<PlaylistSortToggle />);
    expect(screen.getByLabelText('Sort alphabetically')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Sort by recently updated')).toHaveAttribute('aria-pressed', 'false');
  });

  test('clicking Recent switches the store sortBy back to recent', () => {
    usePlaylistSortStore.setState({ sortBy: 'alpha' });
    render(<PlaylistSortToggle />);
    fireEvent.click(screen.getByLabelText('Sort by recently updated'));
    expect(usePlaylistSortStore.getState().sortBy).toBe('recent');
  });
});
