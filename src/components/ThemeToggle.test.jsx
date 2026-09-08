import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from './ThemeToggle';
import { useThemeStore } from '../stores/themeStore';

beforeEach(() => {
  useThemeStore.setState({ mode: 'system', resolvedTheme: 'light' });
});

describe('ThemeToggle', () => {
  test('highlights the active mode', () => {
    render(<ThemeToggle />);
    expect(screen.getByText('System')).toHaveStyle({ color: 'rgb(255, 255, 255)' });
    expect(screen.getByText('Light')).toHaveStyle({ color: 'rgb(156, 163, 175)' });
  });

  test('clicking Dark switches the mode', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByText('Dark'));
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  test('clicking Light switches the mode', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByText('Light'));
    expect(useThemeStore.getState().mode).toBe('light');
  });

  test('dark variant (default) uses the dark-surface pill background', () => {
    render(<ThemeToggle />);
    expect(screen.getByText('Light').parentElement).toHaveStyle({ background: '#1a252f' });
  });

  test('light variant uses a light pill background and inactive text color', () => {
    render(<ThemeToggle variant="light" />);
    expect(screen.getByText('Light').parentElement).toHaveStyle({ background: '#f3f4f6' });
    expect(screen.getByText('Dark')).toHaveStyle({ color: 'rgb(107, 114, 128)' });
  });
});
