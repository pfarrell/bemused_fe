import { useEffect, useRef } from 'react';

// Notifies via the browser tab title while this tab is backgrounded and
// upload batches are in flight. Restores the original title the instant the
// tab regains focus — the in-page batch strip already covers that case, so
// the title only needs to carry information when you're not looking.
export function useUploadTabTitle(inFlightBatches) {
  const originalTitleRef = useRef(document.title);
  const prevIdsRef = useRef(new Set());
  const inFlightBatchesRef = useRef(inFlightBatches);

  // Keep inFlightBatches in sync with the ref so visibility listener always sees fresh data
  useEffect(() => {
    inFlightBatchesRef.current = inFlightBatches;
  }, [inFlightBatches]);

  const applyTitle = (showCompletionFlash = false) => {
    const batches = inFlightBatchesRef.current;
    const uploadingCount = batches.filter((b) => b.status === 'uploading').length;

    if (!document.hidden) {
      document.title = originalTitleRef.current;
      return;
    }

    if (showCompletionFlash) {
      const currentIds = new Set(batches.map((b) => b.id));
      const completedIds = [...prevIdsRef.current].filter((id) => !currentIds.has(id));
      prevIdsRef.current = currentIds;

      if (completedIds.length > 0) {
        document.title = uploadingCount === 0
          ? '✓ All uploads complete'
          : `✓ Batch done — ${uploadingCount} left`;
        return;
      }
    }

    document.title = uploadingCount > 0
      ? `(${uploadingCount} uploading) ${originalTitleRef.current}`
      : originalTitleRef.current;
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
}
