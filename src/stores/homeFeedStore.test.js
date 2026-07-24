import { describe, test, expect, beforeEach } from 'vitest';
import { useHomeFeedStore, getHomeFeedCache } from './homeFeedStore';

const DEFAULT_STATE = { key: null, items: [], hasMore: true, seenIds: new Set(), scrollTop: 0 };

beforeEach(() => {
  useHomeFeedStore.setState(DEFAULT_STATE);
});

describe('homeFeedStore', () => {
  test('starts empty', () => {
    const state = useHomeFeedStore.getState();
    expect(state.key).toBeNull();
    expect(state.items).toEqual([]);
    expect(state.hasMore).toBe(true);
    expect(state.seenIds).toEqual(new Set());
    expect(state.scrollTop).toBe(0);
  });

  test('save writes items under a key', () => {
    useHomeFeedStore.getState().save('artists:', { items: [{ id: 1 }], hasMore: false, seenIds: new Set([1]) });
    const state = useHomeFeedStore.getState();
    expect(state.key).toBe('artists:');
    expect(state.items).toEqual([{ id: 1 }]);
    expect(state.hasMore).toBe(false);
  });

  test('getHomeFeedCache returns the state when the key matches', () => {
    useHomeFeedStore.getState().save('albums:rock', { items: [{ id: 2 }] });
    expect(getHomeFeedCache('albums:rock').items).toEqual([{ id: 2 }]);
  });

  test('getHomeFeedCache returns null when the key does not match', () => {
    useHomeFeedStore.getState().save('albums:rock', { items: [{ id: 2 }] });
    expect(getHomeFeedCache('artists:')).toBeNull();
  });

  test('save merges into the same key without dropping other fields', () => {
    useHomeFeedStore.getState().save('artists:', { items: [{ id: 1 }], hasMore: true, seenIds: new Set([1]) });
    useHomeFeedStore.getState().save('artists:', { scrollTop: 120 });
    const state = useHomeFeedStore.getState();
    expect(state.items).toEqual([{ id: 1 }]);
    expect(state.scrollTop).toBe(120);
  });

  test('save under a new key resets stale fields from the previous key', () => {
    useHomeFeedStore.getState().save('artists:', { items: [{ id: 1 }], scrollTop: 500 });
    useHomeFeedStore.getState().save('albums:', { items: [{ id: 2 }] });
    const state = useHomeFeedStore.getState();
    expect(state.key).toBe('albums:');
    expect(state.items).toEqual([{ id: 2 }]);
    expect(state.scrollTop).toBe(0);
  });

  test('invalidate resets to the empty state', () => {
    useHomeFeedStore.getState().save('artists:', { items: [{ id: 1 }], scrollTop: 500 });
    useHomeFeedStore.getState().invalidate();
    const state = useHomeFeedStore.getState();
    expect(state.key).toBeNull();
    expect(state.items).toEqual([]);
    expect(state.scrollTop).toBe(0);
  });
});
