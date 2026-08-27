import { usePlaylistSortStore } from './playlistSortStore';

beforeEach(() => {
  localStorage.clear();
  usePlaylistSortStore.setState({ sortBy: 'recent' });
});

describe('playlistSortStore', () => {
  test('defaults to recent sort', () => {
    expect(usePlaylistSortStore.getState().sortBy).toBe('recent');
  });

  test('setSortBy updates state', () => {
    usePlaylistSortStore.getState().setSortBy('alpha');
    expect(usePlaylistSortStore.getState().sortBy).toBe('alpha');
  });

  test('setSortBy persists to localStorage under playlist-sort', () => {
    usePlaylistSortStore.getState().setSortBy('alpha');
    expect(localStorage.getItem('playlist-sort')).toBe('alpha');
  });

  test('reads the persisted value back on next read', () => {
    localStorage.setItem('playlist-sort', 'alpha');
    expect(localStorage.getItem('playlist-sort')).toBe('alpha');
  });
});
