import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Wikipedia from './Wikipedia';

const summary = {
  summary: 'A summary of the artist.',
  url: 'https://en.wikipedia.org/wiki/Some_Artist',
};

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
});

test('renders the desktop Wikipedia URL on a desktop viewport', () => {
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
  render(<Wikipedia summary={summary} />);
  expect(screen.getByText('...more at wikipedia')).toHaveAttribute(
    'href',
    'https://en.wikipedia.org/wiki/Some_Artist'
  );
});

test('rewrites the link to the mobile Wikipedia domain on a mobile viewport', () => {
  Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
  render(<Wikipedia summary={summary} />);
  expect(screen.getByText('...more at wikipedia')).toHaveAttribute(
    'href',
    'https://en.m.wikipedia.org/wiki/Some_Artist'
  );
});

test('renders nothing when summary is empty', () => {
  const { container } = render(<Wikipedia summary={{}} />);
  expect(container).toBeEmptyDOMElement();
});

test('renders nothing when summary.summary is blank', () => {
  const { container } = render(<Wikipedia summary={{ summary: '  ', url: summary.url }} />);
  expect(container).toBeEmptyDOMElement();
});

test('applies the wikipedia-content class to the summary paragraph', () => {
  const { container } = render(<Wikipedia summary={summary} />);
  expect(container.querySelector('p.wikipedia-content')).toBeInTheDocument();
});

test('shows a "Show more" toggle that expands to "Show less"', async () => {
  const user = userEvent.setup();
  render(<Wikipedia summary={summary} />);

  const toggle = screen.getByRole('button', { name: 'Show more' });
  expect(toggle).toBeInTheDocument();

  await user.click(toggle);

  expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
});
