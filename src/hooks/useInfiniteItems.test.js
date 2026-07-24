import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInfiniteItems } from './useInfiniteItems';
import { useHomeFeedStore } from '../stores/homeFeedStore';

beforeEach(() => {
  useHomeFeedStore.setState({ key: null, items: [], hasMore: true, seenIds: new Set(), scrollTop: 0 });
  // jsdom does not implement matchMedia; useInfiniteItems calls it
  // unconditionally on mount to pick batch/window sizes.
  window.matchMedia = window.matchMedia || (() => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
  }));
});

function makeFetchFn(pages) {
  let call = 0;
  return vi.fn(() => Promise.resolve({ data: pages[call++] ?? [] }));
}

describe('useInfiniteItems caching', () => {
  test('fetches on mount when there is no cache for the key', async () => {
    const fetchFn = makeFetchFn([[{ id: 1 }, { id: 2 }]]);
    const { result } = renderHook(() => useInfiniteItems(fetchFn, 'artists:'));

    expect(result.current.hydrated).toBe(false);
    expect(result.current.items).toEqual([]);

    await act(async () => { await result.current.loadMore(); });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result.current.items).toEqual([{ id: 1 }, { id: 2 }]);
  });

  test('hydrates from cache and skips fetching when a matching cache entry exists', () => {
    useHomeFeedStore.getState().save('artists:', {
      items: [{ id: 9 }], hasMore: false, seenIds: new Set([9]),
    });
    const fetchFn = vi.fn();
    const { result } = renderHook(() => useInfiniteItems(fetchFn, 'artists:'));

    expect(result.current.hydrated).toBe(true);
    expect(result.current.items).toEqual([{ id: 9 }]);
    expect(result.current.hasMore).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('does not hydrate when the cached key does not match', () => {
    useHomeFeedStore.getState().save('albums:', { items: [{ id: 9 }], hasMore: false });
    const fetchFn = makeFetchFn([[{ id: 1 }]]);
    const { result } = renderHook(() => useInfiniteItems(fetchFn, 'artists:'));

    expect(result.current.hydrated).toBe(false);
    expect(result.current.items).toEqual([]);
  });

  test('writes fetched items back to the cache under the given key', async () => {
    const fetchFn = makeFetchFn([[{ id: 1 }, { id: 2 }]]);
    const { result } = renderHook(() => useInfiniteItems(fetchFn, 'albums:rock'));

    await act(async () => { await result.current.loadMore(); });

    const cached = useHomeFeedStore.getState();
    expect(cached.key).toBe('albums:rock');
    expect(cached.items).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
