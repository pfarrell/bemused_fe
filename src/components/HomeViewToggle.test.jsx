import { render, screen, fireEvent } from '@testing-library/react';
import HomeViewToggle from './HomeViewToggle';
import { useHomeModeStore } from '../stores/homeModeStore';

beforeEach(() => {
  useHomeModeStore.setState({ mode: 'artists' });
});

describe('HomeViewToggle', () => {
  test('highlights the active mode', () => {
    render(<HomeViewToggle />);
    expect(screen.getByText('Artists')).toHaveStyle({ color: 'rgb(255, 255, 255)' });
    expect(screen.getByText('Albums')).toHaveStyle({ color: 'rgb(156, 163, 175)' });
  });

  test('clicking Albums switches the mode', () => {
    render(<HomeViewToggle />);
    fireEvent.click(screen.getByText('Albums'));
    expect(useHomeModeStore.getState().mode).toBe('albums');
  });

  test('calls onSelect after switching', () => {
    const onSelect = vi.fn();
    render(<HomeViewToggle onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Albums'));
    expect(onSelect).toHaveBeenCalled();
  });

  test('does not throw when onSelect is omitted', () => {
    render(<HomeViewToggle />);
    expect(() => fireEvent.click(screen.getByText('Artists'))).not.toThrow();
  });
});
