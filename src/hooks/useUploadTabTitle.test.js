import { renderHook } from '@testing-library/react';
import { useUploadTabTitle } from './useUploadTabTitle';
import { useTabTitleStore } from '../stores/tabTitleStore';

const setHidden = (hidden) => {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
};

const getOverride = () => useTabTitleStore.getState().override;

describe('useUploadTabTitle', () => {
  beforeEach(() => {
    useTabTitleStore.setState({ override: null });
  });

  afterEach(() => {
    setHidden(false);
  });

  test('does not set an override while the tab is visible', () => {
    setHidden(false);
    renderHook(({ batches }) => useUploadTabTitle(batches), {
      initialProps: { batches: [{ id: '1', fileCount: 2, status: 'uploading' }] },
    });
    expect(getOverride()).toBeNull();
  });

  test('shows an uploading count override while the tab is hidden', () => {
    setHidden(true);
    renderHook(({ batches }) => useUploadTabTitle(batches), {
      initialProps: { batches: [{ id: '1', fileCount: 2, status: 'uploading' }] },
    });
    expect(getOverride()).toBe('(1 uploading)');
  });

  test('flashes a completion message with the remaining count when a batch finishes while hidden', () => {
    setHidden(true);
    const { rerender } = renderHook(({ batches }) => useUploadTabTitle(batches), {
      initialProps: {
        batches: [
          { id: '1', fileCount: 2, status: 'uploading' },
          { id: '2', fileCount: 1, status: 'uploading' },
        ],
      },
    });
    rerender({ batches: [{ id: '2', fileCount: 1, status: 'uploading' }] });
    expect(getOverride()).toBe('✓ Batch done — 1 left');
  });

  test('shows an all-complete message when the last batch finishes while hidden', () => {
    setHidden(true);
    const { rerender } = renderHook(({ batches }) => useUploadTabTitle(batches), {
      initialProps: { batches: [{ id: '1', fileCount: 2, status: 'uploading' }] },
    });
    rerender({ batches: [] });
    expect(getOverride()).toBe('✓ All uploads complete');
  });

  test('clears the override as soon as the tab becomes visible again', () => {
    setHidden(true);
    renderHook(({ batches }) => useUploadTabTitle(batches), {
      initialProps: { batches: [{ id: '1', fileCount: 2, status: 'uploading' }] },
    });
    expect(getOverride()).toBe('(1 uploading)');

    setHidden(false);
    expect(getOverride()).toBeNull();
  });

  test('sets the uploading-count override when tab becomes hidden with active uploads', () => {
    setHidden(false);
    renderHook(({ batches }) => useUploadTabTitle(batches), {
      initialProps: { batches: [{ id: '1', fileCount: 2, status: 'uploading' }] },
    });
    expect(getOverride()).toBeNull();

    setHidden(true);
    expect(getOverride()).toBe('(1 uploading)');
  });

  test('shows completion flash when batch completes while backgrounded, even if started while visible', () => {
    setHidden(false);
    const { rerender } = renderHook(({ batches }) => useUploadTabTitle(batches), {
      initialProps: { batches: [{ id: '1', fileCount: 2, status: 'uploading' }] },
    });
    expect(getOverride()).toBeNull(); // Still visible, no override

    setHidden(true);
    expect(getOverride()).toBe('(1 uploading)'); // Now hidden, shows count

    rerender({ batches: [] }); // Batch completes while hidden
    expect(getOverride()).toBe('✓ All uploads complete');
  });

  test('clears a lingering override on unmount', () => {
    setHidden(true);
    const { unmount } = renderHook(({ batches }) => useUploadTabTitle(batches), {
      initialProps: { batches: [{ id: '1', fileCount: 2, status: 'uploading' }] },
    });
    expect(getOverride()).toBe('(1 uploading)');

    unmount();
    expect(getOverride()).toBeNull();
  });
});
