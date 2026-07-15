import toast from 'react-hot-toast';

const buttonStyle = {
  padding: '0.5rem 1rem',
  backgroundColor: 'white',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.875rem',
};

const ShareButton = ({ title, text }) => {
  const handleShare = async () => {
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

  return (
    <button onClick={handleShare} style={buttonStyle}>
      ⤴ Share
    </button>
  );
};

export default ShareButton;
