import { renderHook } from '@testing-library/react';
import { useUploadTabTitle } from './useUploadTabTitle';

const setHidden = (hidden) => {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('useUploadTabTitle', () => {
  afterEach(() => {
    setHidden(false);
  });

  test('does not change the title while the tab is visible', () => {
    document.title = 'Upload Tracks';
    setHidden(false);
    renderHook(({ batches }) => useUploadTabTitle(batches), {
      initialProps: { batches: [{ id: '1', fileCount: 2, status: 'uploading' }] },
    });
    expect(document.title).toBe('Upload Tracks');
  });

  test('shows an uploading count in the title while the tab is hidden', () => {
    document.title = 'Upload Tracks';
    setHidden(true);
    renderHook(({ batches }) => useUploadTabTitle(batches), {
      initialProps: { batches: [{ id: '1', fileCount: 2, status: 'uploading' }] },
    });
    expect(document.title).toBe('(1 uploading) Upload Tracks');
  });

  test('flashes a completion message with the remaining count when a batch finishes while hidden', () => {
    document.title = 'Upload Tracks';
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
    expect(document.title).toBe('✓ Batch done — 1 left');
  });

  test('shows an all-complete message when the last batch finishes while hidden', () => {
    document.title = 'Upload Tracks';
    setHidden(true);
    const { rerender } = renderHook(({ batches }) => useUploadTabTitle(batches), {
      initialProps: { batches: [{ id: '1', fileCount: 2, status: 'uploading' }] },
    });
    rerender({ batches: [] });
    expect(document.title).toBe('✓ All uploads complete');
  });

  test('restores the original title as soon as the tab becomes visible again', () => {
    document.title = 'Upload Tracks';
    setHidden(true);
    renderHook(({ batches }) => useUploadTabTitle(batches), {
      initialProps: { batches: [{ id: '1', fileCount: 2, status: 'uploading' }] },
    });
    expect(document.title).toBe('(1 uploading) Upload Tracks');

    setHidden(false);
    expect(document.title).toBe('Upload Tracks');
  });

  test('applies uploading count title when tab becomes hidden with active uploads', () => {
    document.title = 'Upload Tracks';
    setHidden(false);
    renderHook(({ batches }) => useUploadTabTitle(batches), {
      initialProps: { batches: [{ id: '1', fileCount: 2, status: 'uploading' }] },
    });
    expect(document.title).toBe('Upload Tracks');

    setHidden(true);
    expect(document.title).toBe('(1 uploading) Upload Tracks');
  });
});
