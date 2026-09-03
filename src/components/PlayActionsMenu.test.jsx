import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, test, expect } from 'vitest';
import PlayActionsMenu from './PlayActionsMenu';

describe('PlayActionsMenu', () => {
  test('renders a Play Now button that calls onPlayNow', async () => {
    const onPlayNow = vi.fn();
    const user = userEvent.setup();
    render(<PlayActionsMenu onPlayNow={onPlayNow} onPlayNext={vi.fn()} onAddToQueue={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Play Now' }));

    expect(onPlayNow).toHaveBeenCalledTimes(1);
  });

  test('omits the Play Now button when onPlayNow is not provided', () => {
    render(<PlayActionsMenu onPlayNext={vi.fn()} onAddToQueue={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Play Now' })).not.toBeInTheDocument();
  });

  test('omits the ▾ toggle when neither onPlayNext nor onAddToQueue is provided', () => {
    render(<PlayActionsMenu onPlayNow={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'More play options' })).not.toBeInTheDocument();
  });

  test('▾ toggle opens a menu with Play Next and Add to Queue', async () => {
    const user = userEvent.setup();
    render(<PlayActionsMenu onPlayNow={vi.fn()} onPlayNext={vi.fn()} onAddToQueue={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'More play options' }));

    expect(screen.getByRole('button', { name: '⏭ Play Next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '➕ Add to Queue' })).toBeInTheDocument();
  });

  test('clicking Play Next in the menu calls onPlayNext and closes the menu', async () => {
    const onPlayNext = vi.fn();
    const user = userEvent.setup();
    render(<PlayActionsMenu onPlayNow={vi.fn()} onPlayNext={onPlayNext} onAddToQueue={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'More play options' }));
    await user.click(screen.getByRole('button', { name: '⏭ Play Next' }));

    expect(onPlayNext).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '⏭ Play Next' })).not.toBeInTheDocument();
  });

  test('clicking Add to Queue in the menu calls onAddToQueue and closes the menu', async () => {
    const onAddToQueue = vi.fn();
    const user = userEvent.setup();
    render(<PlayActionsMenu onPlayNow={vi.fn()} onPlayNext={vi.fn()} onAddToQueue={onAddToQueue} />);

    await user.click(screen.getByRole('button', { name: 'More play options' }));
    await user.click(screen.getByRole('button', { name: '➕ Add to Queue' }));

    expect(onAddToQueue).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '➕ Add to Queue' })).not.toBeInTheDocument();
  });

  test('clicking the backdrop closes the play menu without calling any handler', async () => {
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

  test('disabled disables Play Now and the ▾ toggle but not the ⋯ toggle', () => {
    render(
      <PlayActionsMenu
        onPlayNow={vi.fn()}
        onPlayNext={vi.fn()}
        overflowActions={[{ key: 'share', icon: '📤', label: 'Share', onClick: vi.fn() }]}
        disabled
      />
    );

    expect(screen.getByRole('button', { name: 'Play Now' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'More play options' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'More actions' })).toBeEnabled();
  });

  test('omits the ⋯ toggle when no overflowActions are provided', () => {
    render(<PlayActionsMenu onPlayNow={vi.fn()} onPlayNext={vi.fn()} onAddToQueue={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
  });

  test('⋯ toggle opens a menu listing each overflow action and invokes its onClick, closing the menu', async () => {
    const onEdit = vi.fn();
    const onShare = vi.fn();
    const user = userEvent.setup();
    render(
      <PlayActionsMenu
        onPlayNow={vi.fn()}
        overflowActions={[
          { key: 'edit', icon: '✎', label: 'Edit', onClick: onEdit },
          { key: 'share', icon: '📤', label: 'Share', onClick: onShare },
        ]}
      />
    );

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('button', { name: '✎ Edit' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '📤 Share' }));

    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '📤 Share' })).not.toBeInTheDocument();
  });

  test('clicking the backdrop closes the overflow menu without calling any handler', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(
      <PlayActionsMenu
        onPlayNow={vi.fn()}
        overflowActions={[{ key: 'edit', icon: '✎', label: 'Edit', onClick: onEdit }]}
      />
    );

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByTestId('overflow-menu-backdrop'));

    expect(screen.queryByRole('button', { name: '✎ Edit' })).not.toBeInTheDocument();
    expect(onEdit).not.toHaveBeenCalled();
  });

  test('clamps dropdown menu to viewport bounds when toggle button is near right edge', async () => {
    const user = userEvent.setup();
    render(
      <PlayActionsMenu onPlayNow={vi.fn()} onPlayNext={vi.fn()} onAddToQueue={vi.fn()} />
    );

    // Save original values for restoration
    const originalInnerWidth = window.innerWidth;

    // Mock a narrow viewport (375px typical phone width)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    // Find the toggle button (▾) and mock its getBoundingClientRect
    const toggleButton = screen.getByRole('button', { name: 'More play options' });
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = vi.fn(function() {
      // If this is the toggle button, return a rect positioned near the right edge
      if (this === toggleButton) {
        return {
          top: 100,
          left: 300, // Near right edge of 375px viewport
          bottom: 150,
          right: 350,
          width: 50,
          height: 50,
          x: 300,
          y: 100,
        };
      }
      // For other elements, use the original implementation
      return originalGetBoundingClientRect.call(this);
    });

    // Open the menu
    await user.click(toggleButton);

    // Get the dropdown menu container
    const dropdownMenu = screen.getByRole('button', { name: '⏭ Play Next' }).closest('.track-dropdown');
    const computedStyle = window.getComputedStyle(dropdownMenu);
    const left = parseInt(computedStyle.left, 10);

    // Menu should be clamped: left + 200 (menuWidth) <= 375 - 10 (margin)
    // So left should be <= 165
    expect(left).toBeLessThanOrEqual(165);

    // Restore original values
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });
});
