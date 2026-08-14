import { useEffect, useRef } from 'react';

// Notifies via the browser tab title while this tab is backgrounded and
// upload batches are in flight. Restores the original title the instant the
// tab regains focus — the in-page batch strip already covers that case, so
// the title only needs to carry information when you're not looking.
export function useUploadTabTitle(inFlightBatches) {
  const originalTitleRef = useRef(document.title);
  const prevIdsRef = useRef(new Set());

  useEffect(() => {
    const uploadingCount = inFlightBatches.filter((b) => b.status === 'uploading').length;
    const currentIds = new Set(inFlightBatches.map((b) => b.id));
    const completedIds = [...prevIdsRef.current].filter((id) => !currentIds.has(id));
    prevIdsRef.current = currentIds;

    if (!document.hidden) {
      document.title = originalTitleRef.current;
      return;
    }

    if (completedIds.length > 0) {
      document.title = uploadingCount === 0
        ? '✓ All uploads complete'
        : `✓ Batch done — ${uploadingCount} left`;
      return;
    }

    document.title = uploadingCount > 0
      ? `(${uploadingCount} uploading) ${originalTitleRef.current}`
      : originalTitleRef.current;
  }, [inFlightBatches]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) document.title = originalTitleRef.current;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
}
