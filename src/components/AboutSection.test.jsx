import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import AboutSection from './AboutSection';

const summary = {
  summary: 'A summary of the album.',
  url: 'https://en.wikipedia.org/wiki/Some_Album',
};

describe('AboutSection', () => {
  test('renders nothing when there is no Wikipedia summary', () => {
    const { container } = render(<AboutSection heading="About this album" summary={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders the heading and Wikipedia excerpt when a summary is present', () => {
    render(<AboutSection heading="About this album" summary={summary} />);
    expect(screen.getByText('About this album')).toBeInTheDocument();
    expect(screen.getByText(/A summary of the album/)).toBeInTheDocument();
  });

  test('renders nothing when summary is null', () => {
    const { container } = render(<AboutSection heading="About this album" summary={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
