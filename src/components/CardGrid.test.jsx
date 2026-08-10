import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import CardGrid from './CardGrid';
import { useViewModeStore } from '../stores/viewModeStore';

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
});

beforeEach(() => {
  useViewModeStore.setState({ mode: 'card' });
});

describe('CardGrid', () => {
  test('renders children', () => {
    render(<CardGrid><div>child content</div></CardGrid>);
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  test('desktop + card mode: does not add the view-list class', () => {
    const { container } = render(<CardGrid><div>x</div></CardGrid>);
    const grid = container.querySelector('.artist-grid-container');
    expect(grid).not.toHaveClass('view-list');
  });

  test('desktop + list mode: adds the view-list class', () => {
    useViewModeStore.setState({ mode: 'list' });
    const { container } = render(<CardGrid><div>x</div></CardGrid>);
    const grid = container.querySelector('.artist-grid-container');
    expect(grid).toHaveClass('view-list');
  });

  test('mobile + list mode: does not add the view-list class', () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    useViewModeStore.setState({ mode: 'list' });
    const { container } = render(<CardGrid><div>x</div></CardGrid>);
    const grid = container.querySelector('.artist-grid-container');
    expect(grid).not.toHaveClass('view-list');
  });

  test('forwards ref to the container div', () => {
    const ref = createRef();
    render(<CardGrid ref={ref}><div>x</div></CardGrid>);
    expect(ref.current).toHaveClass('artist-grid-container');
  });
});
