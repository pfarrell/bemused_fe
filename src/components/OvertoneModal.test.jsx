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

  test('a bemused-link message from the iframe closes the modal and navigates', () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    render(
      <OvertoneModal
        url="https://patf.com/overtone/entity/abc-123"
        onClose={onClose}
        onNavigate={onNavigate}
      />
    );
    const iframe = screen.getByTitle('Overtone');

    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://patf.com',
      source: iframe.contentWindow,
      data: { source: 'overtone-bemused-link', url: 'https://patf.com/pshare/app/album/123' },
    }));

    expect(onClose).toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith('/album/123');
  });

  test('ignores a message from the wrong origin', () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    render(
      <OvertoneModal
        url="https://patf.com/overtone/entity/abc-123"
        onClose={onClose}
        onNavigate={onNavigate}
      />
    );
    const iframe = screen.getByTitle('Overtone');

    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://evil.example',
      source: iframe.contentWindow,
      data: { source: 'overtone-bemused-link', url: 'https://patf.com/pshare/app/album/123' },
    }));

    expect(onClose).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  test('ignores a same-origin message with the wrong source tag', () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    render(
      <OvertoneModal
        url="https://patf.com/overtone/entity/abc-123"
        onClose={onClose}
        onNavigate={onNavigate}
      />
    );
    const iframe = screen.getByTitle('Overtone');

    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://patf.com',
      source: iframe.contentWindow,
      data: { source: 'something-else', url: 'https://patf.com/pshare/app/album/123' },
    }));

    expect(onClose).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
