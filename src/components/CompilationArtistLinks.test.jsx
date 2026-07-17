import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import CompilationArtistLinks from './CompilationArtistLinks';

const manyArtists = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: `Artist ${i + 1}` }));

// Captures the current location so we can assert navigation happened
const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const renderLinks = (artists) =>
  render(
    <MemoryRouter>
      <CompilationArtistLinks artists={artists} />
      <LocationDisplay />
    </MemoryRouter>
  );

describe('CompilationArtistLinks', () => {
  test('renders all artists when 15 or fewer, with no "more" toggle', () => {
    const artists = manyArtists.slice(0, 5);
    renderLinks(artists);
    artists.forEach((a) => expect(screen.getByText(a.name)).toBeInTheDocument());
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  test('shows only the first 15 artists plus a "+ N more" toggle when there are more than 15', () => {
    renderLinks(manyArtists);
    expect(screen.getByText('Artist 1')).toBeInTheDocument();
    expect(screen.getByText('Artist 15')).toBeInTheDocument();
    expect(screen.queryByText('Artist 16')).not.toBeInTheDocument();
    expect(screen.getByText('+ 5 more')).toBeInTheDocument();
  });

  test('clicking "+ N more" expands to show every remaining artist', async () => {
    const user = userEvent.setup();
    renderLinks(manyArtists);
    await user.click(screen.getByText('+ 5 more'));
    expect(screen.getByText('Artist 20')).toBeInTheDocument();
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  test('clicking an artist name navigates to their artist page', async () => {
    const user = userEvent.setup();
    renderLinks(manyArtists.slice(0, 3));
    await user.click(screen.getByText('Artist 2'));
    expect(screen.getByTestId('location')).toHaveTextContent('/artist/2');
  });

  describe('on a mobile viewport', () => {
    const originalInnerWidth = window.innerWidth;

    beforeEach(() => {
      window.innerWidth = 500;
    });

    afterEach(() => {
      window.innerWidth = originalInnerWidth;
    });

    test('uses the default visible count when no mobileVisibleCount is given', () => {
      renderLinks(manyArtists);
      expect(screen.getByText('Artist 15')).toBeInTheDocument();
      expect(screen.queryByText('Artist 16')).not.toBeInTheDocument();
      expect(screen.getByText('+ 5 more')).toBeInTheDocument();
    });

    test('shows only mobileVisibleCount artists plus a "+ N more" toggle when given', () => {
      render(
        <MemoryRouter>
          <CompilationArtistLinks artists={manyArtists} mobileVisibleCount={5} />
        </MemoryRouter>
      );
      expect(screen.getByText('Artist 5')).toBeInTheDocument();
      expect(screen.queryByText('Artist 6')).not.toBeInTheDocument();
      expect(screen.getByText('+ 15 more')).toBeInTheDocument();
    });

    test('clicking "+ N more" on mobile expands to show every remaining artist', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <CompilationArtistLinks artists={manyArtists} mobileVisibleCount={5} />
        </MemoryRouter>
      );
      await user.click(screen.getByText('+ 15 more'));
      expect(screen.getByText('Artist 20')).toBeInTheDocument();
      expect(screen.queryByText(/more/)).not.toBeInTheDocument();
    });
  });
});
