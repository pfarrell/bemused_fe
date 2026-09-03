import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import toast from 'react-hot-toast';
import { shareLink } from './shareLink';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

describe('shareLink', () => {
  const originalShare = navigator.share;
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.stubGlobal('location', { ...window.location, href: 'https://patf.com/pshare/app/album/42' });
    toast.success.mockClear();
    toast.error.mockClear();
  });

  afterEach(() => {
    if (originalShare === undefined) delete navigator.share;
    else navigator.share = originalShare;
    if (originalClipboard === undefined) delete navigator.clipboard;
    else Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
    vi.unstubAllGlobals();
  });

  test('calls navigator.share with title, text, and current URL when available', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    navigator.share = shareMock;

    await shareLink({ title: 'Abbey Road', text: 'Abbey Road by The Beatles' });

    expect(shareMock).toHaveBeenCalledWith({
      title: 'Abbey Road',
      text: 'Abbey Road by The Beatles',
      url: 'https://patf.com/pshare/app/album/42',
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  test('swallows AbortError from navigator.share without any toast', async () => {
    const abortError = new Error('cancelled');
    abortError.name = 'AbortError';
    navigator.share = vi.fn().mockRejectedValue(abortError);

    await shareLink({ title: 'Abbey Road', text: 'Abbey Road by The Beatles' });

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  test('falls back to clipboard when navigator.share rejects with a non-abort error', async () => {
    navigator.share = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    await shareLink({ title: 'Abbey Road', text: 'Abbey Road by The Beatles' });

    expect(writeTextMock).toHaveBeenCalledWith('https://patf.com/pshare/app/album/42');
    expect(toast.success).toHaveBeenCalledWith('Link copied');
  });

  test('copies to clipboard directly when navigator.share is unavailable', async () => {
    delete navigator.share;
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    await shareLink({ title: 'Abbey Road', text: 'Abbey Road by The Beatles' });

    expect(writeTextMock).toHaveBeenCalledWith('https://patf.com/pshare/app/album/42');
    expect(toast.success).toHaveBeenCalledWith('Link copied');
  });

  test('shows an error toast when both share and clipboard are unavailable', async () => {
    delete navigator.share;
    delete navigator.clipboard;

    await shareLink({ title: 'Abbey Road', text: 'Abbey Road by The Beatles' });

    expect(toast.error).toHaveBeenCalledWith('Could not copy link');
  });
});
