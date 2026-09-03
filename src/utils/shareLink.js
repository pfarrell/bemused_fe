import toast from 'react-hot-toast';

// Shares the current page via the Web Share API when available, falling
// back to copying the URL to the clipboard (with a toast) otherwise.
export const shareLink = async ({ title, text }) => {
  const url = window.location.href;

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
      // fall through to clipboard fallback below
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  } catch {
    toast.error('Could not copy link');
  }
};
