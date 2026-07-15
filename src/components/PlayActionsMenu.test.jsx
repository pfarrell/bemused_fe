import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, test, expect } from 'vitest';
import PlayActionsMenu from './PlayActionsMenu';

describe('PlayActionsMenu', () => {
  test('renders a Play Now button in both the desktop and mobile variant', () => {
    render(<PlayActionsMenu onPlayNow={vi.fn()} onPlayNext={vi.fn()} onAddToQueue={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: '▶ Play Now' })).toHaveLength(2);
  });

  test('desktop Play Now button calls onPlayNow', async () => {
    const onPlayNow = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <PlayActionsMenu onPlayNow={onPlayNow} onPlayNext={vi.fn()} onAddToQueue={vi.fn()} />
    );
    const desktop = within(container.querySelector('.play-actions-desktop'));

    await user.click(desktop.getByRole('button', { name: '▶ Play Now' }));

    expect(onPlayNow).toHaveBeenCalledTimes(1);
  });

  test('desktop renders separate Play Next and Add to Queue buttons that call their handlers directly', async () => {
    const onPlayNext = vi.fn();
    const onAddToQueue = vi.fn();
    const user = userEvent.setup();
    render(<PlayActionsMenu onPlayNow={vi.fn()} onPlayNext={onPlayNext} onAddToQueue={onAddToQueue} />);

    await user.click(screen.getByRole('button', { name: 'Play Next' }));
    await user.click(screen.getByRole('button', { name: 'Add to Queue' }));

    expect(onPlayNext).toHaveBeenCalledTimes(1);
    expect(onAddToQueue).toHaveBeenCalledTimes(1);
  });

  test('mobile chevron opens a menu with Play Next and Add to Queue', async () => {
    const user = userEvent.setup();
    render(<PlayActionsMenu onPlayNow={vi.fn()} onPlayNext={vi.fn()} onAddToQueue={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'More play options' }));

    expect(screen.getByRole('button', { name: '⏭ Play Next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '➕ Add to Queue' })).toBeInTheDocument();
  });

  test('clicking Play Next in the mobile menu calls onPlayNext and closes the menu', async () => {
    const onPlayNext = vi.fn();
    const user = userEvent.setup();
    render(<PlayActionsMenu onPlayNow={vi.fn()} onPlayNext={onPlayNext} onAddToQueue={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'More play options' }));
    await user.click(screen.getByRole('button', { name: '⏭ Play Next' }));

    expect(onPlayNext).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '⏭ Play Next' })).not.toBeInTheDocument();
  });

  test('clicking Add to Queue in the mobile menu calls onAddToQueue and closes the menu', async () => {
    const onAddToQueue = vi.fn();
    const user = userEvent.setup();
    render(<PlayActionsMenu onPlayNow={vi.fn()} onPlayNext={vi.fn()} onAddToQueue={onAddToQueue} />);

    await user.click(screen.getByRole('button', { name: 'More play options' }));
    await user.click(screen.getByRole('button', { name: '➕ Add to Queue' }));

    expect(onAddToQueue).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '➕ Add to Queue' })).not.toBeInTheDocument();
  });

  test('clicking the backdrop closes the mobile menu without calling any handler', async () => {
    const onPlayNext = vi.fn();
    const onAddToQueue = vi.fn();
    const user = userEvent.setup();
    render(<PlayActionsMenu onPlayNow={vi.fn()} onPlayNext={onPlayNext} onAddToQueue={onAddToQueue} />);

    await user.click(screen.getByRole('button', { name: 'More play options' }));
    expect(screen.getByRole('button', { name: '⏭ Play Next' })).toBeInTheDocument();

    await user.click(screen.getByTestId('play-menu-backdrop'));

    expect(screen.queryByRole('button', { name: '⏭ Play Next' })).not.toBeInTheDocument();
    expect(onPlayNext).not.toHaveBeenCalled();
    expect(onAddToQueue).not.toHaveBeenCalled();
  });
});
