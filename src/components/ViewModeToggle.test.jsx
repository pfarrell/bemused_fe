import { render, screen, fireEvent } from '@testing-library/react';
import ViewModeToggle from './ViewModeToggle';
import { useViewModeStore } from '../stores/viewModeStore';

beforeEach(() => {
  useViewModeStore.setState({ mode: 'card' });
});

describe('ViewModeToggle', () => {
  test('renders a Card view button and a List view button', () => {
    render(<ViewModeToggle />);
    expect(screen.getByLabelText('Card view')).toBeInTheDocument();
    expect(screen.getByLabelText('List view')).toBeInTheDocument();
  });

  test('Card view is pressed by default', () => {
    render(<ViewModeToggle />);
    expect(screen.getByLabelText('Card view')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('List view')).toHaveAttribute('aria-pressed', 'false');
  });

  test('clicking List view switches the store mode to list', () => {
    render(<ViewModeToggle />);
    fireEvent.click(screen.getByLabelText('List view'));
    expect(useViewModeStore.getState().mode).toBe('list');
  });

  test('reflects list mode as pressed once the store is in list mode', () => {
    useViewModeStore.setState({ mode: 'list' });
    render(<ViewModeToggle />);
    expect(screen.getByLabelText('List view')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Card view')).toHaveAttribute('aria-pressed', 'false');
  });

  test('clicking Card view switches the store mode back to card', () => {
    useViewModeStore.setState({ mode: 'list' });
    render(<ViewModeToggle />);
    fireEvent.click(screen.getByLabelText('Card view'));
    expect(useViewModeStore.getState().mode).toBe('card');
  });
});
