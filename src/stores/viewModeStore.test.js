import { useViewModeStore } from './viewModeStore';

beforeEach(() => {
  localStorage.clear();
  useViewModeStore.setState({ mode: 'card' });
});

describe('viewModeStore', () => {
  test('defaults to card mode', () => {
    expect(useViewModeStore.getState().mode).toBe('card');
  });

  test('setMode updates state', () => {
    useViewModeStore.getState().setMode('list');
    expect(useViewModeStore.getState().mode).toBe('list');
  });

  test('setMode persists to localStorage under browse-view-mode', () => {
    useViewModeStore.getState().setMode('list');
    expect(localStorage.getItem('browse-view-mode')).toBe('list');
  });

  test('reads the persisted value back on next read', () => {
    localStorage.setItem('browse-view-mode', 'list');
    expect(localStorage.getItem('browse-view-mode')).toBe('list');
  });
});
