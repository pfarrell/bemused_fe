import { render, screen } from '@testing-library/react';
import AlbumStubCard from './AlbumStubCard';

vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => false }));

describe('AlbumStubCard', () => {
  test('renders the title and artist name', () => {
    render(<AlbumStubCard stub={{ id: 1, title: 'Abbey Road', artist_name: 'The Beatles' }} />);
    expect(screen.getByText('Abbey Road')).toBeInTheDocument();
    expect(screen.getByText('The Beatles')).toBeInTheDocument();
  });

  test('renders without an artist name', () => {
    render(<AlbumStubCard stub={{ id: 2, title: 'Untitled', artist_name: null }} />);
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  test('applies the dashed-border stub class', () => {
    render(<AlbumStubCard stub={{ id: 1, title: 'Abbey Road', artist_name: 'The Beatles' }} />);
    expect(screen.getByTestId('album-stub-card')).toHaveClass('album-stub-card');
  });
});
