import { render, screen, fireEvent } from '@testing-library/react';
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
  expect(screen.getByText('more')).toHaveAttribute(
    'href',
    'https://en.wikipedia.org/wiki/Some_Artist'
  );
});

test('rewrites the link to the mobile Wikipedia domain on a mobile viewport', () => {
  Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
  render(<Wikipedia summary={summary} />);
  expect(screen.getByText('more')).toHaveAttribute(
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

const longSummary = {
  summary:
    'Duit on Mon Dei is the eleventh album by American singer and songwriter Harry Nilsson, released by RCA Victor in March 1975. Its provisional title was God\'s Greatest Hits but management at RCA Records did not approve. The title is a punning spelling of "Do It On Monday".',
  url: 'https://en.wikipedia.org/wiki/Duit_on_Mon_Dei',
};

test('truncates a long summary to a word boundary with an ellipsis on a mobile viewport', () => {
  Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
  render(<Wikipedia summary={longSummary} />);

  const paragraph = screen.getByText(/Duit on Mon Dei/);
  expect(paragraph.textContent).not.toContain('Do It On Monday');
  expect(paragraph.textContent).toMatch(/…\s*more$/);
});

test('does not truncate a long summary on a desktop viewport', () => {
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
  render(<Wikipedia summary={longSummary} />);

  expect(screen.getByText(/Duit on Mon Dei/).textContent).toContain('Do It On Monday');
});

test('clicking the continue link opens the Wikipedia modal instead of navigating', async () => {
  const user = userEvent.setup();
  render(<Wikipedia summary={summary} />);

  expect(screen.queryByTitle('Wikipedia')).not.toBeInTheDocument();

  await user.click(screen.getByText('more'));

  expect(screen.getByTitle('Wikipedia')).toHaveAttribute('src', summary.url);
});

test('closing the modal removes it', async () => {
  const user = userEvent.setup();
  render(<Wikipedia summary={summary} />);

  await user.click(screen.getByText('more'));
  await user.click(screen.getByRole('button', { name: 'Close' }));

  expect(screen.queryByTitle('Wikipedia')).not.toBeInTheDocument();
});

test('a modified click on the continue link is not intercepted', () => {
  render(<Wikipedia summary={summary} />);
  const link = screen.getByText('more');

  fireEvent.click(link, { ctrlKey: true });

  expect(screen.queryByTitle('Wikipedia')).not.toBeInTheDocument();
});
