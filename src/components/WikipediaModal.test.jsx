// src/components/WikipediaModal.test.jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WikipediaModal from './WikipediaModal';

describe('WikipediaModal', () => {
  test('renders an iframe pointed at the given url', () => {
    render(<WikipediaModal url="https://en.wikipedia.org/wiki/Radiohead" onClose={vi.fn()} />);
    expect(screen.getByTitle('Wikipedia')).toHaveAttribute('src', 'https://en.wikipedia.org/wiki/Radiohead');
  });

  test('close button calls onClose', async () => {
    const onClose = vi.fn();
    render(<WikipediaModal url="https://en.wikipedia.org/wiki/Radiohead" onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  test('clicking the backdrop calls onClose', async () => {
    const onClose = vi.fn();
    render(<WikipediaModal url="https://en.wikipedia.org/wiki/Radiohead" onClose={onClose} />);
    await userEvent.click(screen.getByTestId('wikipedia-modal-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
