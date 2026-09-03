import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, test, expect } from 'vitest';
import AboutSection from './AboutSection';

const summary = {
  summary: 'A summary of the album.',
  url: 'https://en.wikipedia.org/wiki/Some_Album',
};

const renderAbout = (props) =>
  render(
    <MemoryRouter>
      <AboutSection {...props} />
    </MemoryRouter>
  );

describe('AboutSection', () => {
  test('renders nothing when there is no Wikipedia summary and no musicbrainz id', () => {
    const { container } = renderAbout({ heading: 'About this album', summary: {} });
    expect(container).toBeEmptyDOMElement();
  });

  test('renders the heading and Wikipedia excerpt when a summary is present', () => {
    renderAbout({ heading: 'About this album', summary });
    expect(screen.getByText('About this album')).toBeInTheDocument();
    expect(screen.getByText(/A summary of the album/)).toBeInTheDocument();
  });

  test('renders an Overtone link when musicbrainzId is present, using the release path for entityType="release"', () => {
    renderAbout({ heading: 'About this album', summary: {}, musicbrainzId: 'xyz-789', entityType: 'release' });
    expect(screen.getByRole('link', { name: 'Overtone' })).toHaveAttribute(
      'href',
      'https://patf.com/overtone/release/xyz-789'
    );
  });

  test('renders an Overtone link using the entity path by default (artist)', () => {
    renderAbout({ heading: 'About this artist', summary: {}, musicbrainzId: 'abc-123' });
    expect(screen.getByRole('link', { name: 'Overtone' })).toHaveAttribute(
      'href',
      'https://patf.com/overtone/entity/abc-123'
    );
  });

  test('does not render an Overtone link when musicbrainzId is absent', () => {
    renderAbout({ heading: 'About this album', summary });
    expect(screen.queryByRole('link', { name: 'Overtone' })).not.toBeInTheDocument();
  });

  test('clicking the Overtone link opens a modal instead of navigating', () => {
    renderAbout({ heading: 'About this album', summary: {}, musicbrainzId: 'xyz-789', entityType: 'release' });

    fireEvent.click(screen.getByRole('link', { name: 'Overtone' }));

    expect(screen.getByTitle('Overtone')).toHaveAttribute('src', 'https://patf.com/overtone/release/xyz-789');
  });

  test('renders the section (for the Overtone link) even when there is no Wikipedia summary', () => {
    renderAbout({ heading: 'About this album', summary: {}, musicbrainzId: 'xyz-789', entityType: 'release' });
    expect(screen.getByText('About this album')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overtone' })).toBeInTheDocument();
  });
});
