import { useEffect, useRef } from 'react';
import { useTabTitleStore } from '../stores/tabTitleStore';

// Notifies via the browser tab title while this tab is backgrounded and
// upload batches are in flight: a live "(N uploading)" countdown that
// updates immediately as each batch finishes, settling on "All uploads
// complete" once none remain. Restores control to the player's own title
// the instant the tab regains focus — the in-page batch strip already
// covers that case, so the title only needs to carry information when
// you're not looking. Goes through tabTitleStore's override rather than
// writing document.title directly, since usePlayerEngine is mounted
// globally and would otherwise race this hook for ownership of the tab title.
export function useUploadTabTitle(inFlightBatches) {
  const inFlightBatchesRef = useRef(inFlightBatches);
  const sawUploadingRef = useRef(false);

  // Keep inFlightBatches in sync with the ref so the visibility listener always sees fresh data
  useEffect(() => {
    inFlightBatchesRef.current = inFlightBatches;
  }, [inFlightBatches]);

  const applyTitle = () => {
    const { setOverride, clearOverride } = useTabTitleStore.getState();

    if (!document.hidden) {
      sawUploadingRef.current = false;
      clearOverride();
      return;
    }

    const uploadingCount = inFlightBatchesRef.current.filter((b) => b.status === 'uploading').length;

    if (uploadingCount > 0) {
      sawUploadingRef.current = true;
      setOverride(`(${uploadingCount} uploading)`);
    } else if (sawUploadingRef.current) {
      sawUploadingRef.current = false;
      setOverride('✓ All uploads complete');
    } else {
      clearOverride();
    }
  };

  useEffect(() => {
    applyTitle();
  }, [inFlightBatches]);

  useEffect(() => {
    document.addEventListener('visibilitychange', applyTitle);
    return () => document.removeEventListener('visibilitychange', applyTitle);
  }, []);

  // Clear any lingering override on unmount (e.g. navigating away from
  // AdminUpload mid-upload) so the player's own title takes back over
  // instead of a stale "(N uploading)" string being stranded.
  useEffect(() => {
    return () => {
      useTabTitleStore.getState().clearOverride();
    };
  }, []);
}
