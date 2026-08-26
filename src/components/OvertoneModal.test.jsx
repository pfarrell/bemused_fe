// src/components/OvertoneModal.test.jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OvertoneModal from './OvertoneModal';

describe('OvertoneModal', () => {
  test('renders an iframe pointed at the given url', () => {
    render(<OvertoneModal url="https://patf.com/overtone/entity/abc-123" onClose={vi.fn()} />);
    expect(screen.getByTitle('Overtone')).toHaveAttribute('src', 'https://patf.com/overtone/entity/abc-123');
  });

  test('close button calls onClose', async () => {
    const onClose = vi.fn();
    render(<OvertoneModal url="https://patf.com/overtone/entity/abc-123" onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  test('clicking the backdrop calls onClose', async () => {
    const onClose = vi.fn();
    render(<OvertoneModal url="https://patf.com/overtone/entity/abc-123" onClose={onClose} />);
    await userEvent.click(screen.getByTestId('overtone-modal-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
