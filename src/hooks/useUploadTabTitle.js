import { useEffect, useRef } from 'react';
import { useTabTitleStore } from '../stores/tabTitleStore';

// Notifies via the browser tab title while this tab is backgrounded and
// upload batches are in flight. Restores control to the player's own title
// (current track, or the default) the instant the tab regains focus — the
// in-page batch strip already covers that case, so the title only needs to
// carry information when you're not looking. Goes through tabTitleStore's
// override rather than writing document.title directly, since
// usePlayerEngine is mounted globally and would otherwise race this hook
// for ownership of the tab title.
export function useUploadTabTitle(inFlightBatches) {
  const prevIdsRef = useRef(new Set());
  const inFlightBatchesRef = useRef(inFlightBatches);

  // Keep inFlightBatches in sync with the ref so visibility listener always sees fresh data
  useEffect(() => {
    inFlightBatchesRef.current = inFlightBatches;
  }, [inFlightBatches]);

  const applyTitle = (showCompletionFlash = false) => {
    const batches = inFlightBatchesRef.current;
    const uploadingCount = batches.filter((b) => b.status === 'uploading').length;

    // Always compute and track current IDs, regardless of visibility.
    // This ensures prevIdsRef.current is seeded even while visible, so
    // completion detection works when the batch finishes after the tab becomes hidden.
    const currentIds = new Set(batches.map((b) => b.id));
    const prevIds = prevIdsRef.current;
    prevIdsRef.current = currentIds;

    // Compute completed IDs (only meaningful if we're checking for completion)
    let completedIds = [];
    if (showCompletionFlash) {
      completedIds = [...prevIds].filter((id) => !currentIds.has(id));
    }

    const { setOverride, clearOverride } = useTabTitleStore.getState();

    // Only change the title if the tab is hidden
    if (!document.hidden) {
      clearOverride();
      return;
    }

    // Show completion flash if we have completed IDs
    if (showCompletionFlash && completedIds.length > 0) {
      setOverride(uploadingCount === 0
        ? '✓ All uploads complete'
        : `✓ Batch done — ${uploadingCount} left`);
      return;
    }

    if (uploadingCount > 0) {
      setOverride(`(${uploadingCount} uploading)`);
    } else {
      clearOverride();
    }
  };

  useEffect(() => {
    applyTitle(true);
  }, [inFlightBatches]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      applyTitle(false);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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
