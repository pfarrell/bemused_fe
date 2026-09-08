import { describe, test, expect, beforeEach, vi } from 'vitest';

function mockMatchMedia(initialMatches) {
  let listener = null;
  const mql = {
    matches: initialMatches,
    addEventListener: (event, cb) => { if (event === 'change') listener = cb; },
    removeEventListener: (event, cb) => { if (event === 'change' && listener === cb) listener = null; },
  };
  window.matchMedia = vi.fn(() => mql);
  return {
    fireChange(matches) {
      mql.matches = matches;
      listener?.({ matches });
    },
    hasListener: () => listener !== null,
  };
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

describe('themeStore', () => {
  test('defaults to system mode with no stored preference', async () => {
    mockMatchMedia(false);
    const { useThemeStore } = await import('./themeStore');
    expect(useThemeStore.getState().mode).toBe('system');
  });

  test('system mode resolves to light when the OS prefers light', async () => {
    mockMatchMedia(false);
    const { useThemeStore } = await import('./themeStore');
    expect(useThemeStore.getState().resolvedTheme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  test('system mode resolves to dark when the OS prefers dark', async () => {
    mockMatchMedia(true);
    const { useThemeStore } = await import('./themeStore');
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  test('reads a persisted mode from localStorage on load', async () => {
    localStorage.setItem('theme-mode', 'dark');
    mockMatchMedia(false);
    const { useThemeStore } = await import('./themeStore');
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
  });

  test('setMode persists to localStorage and updates resolvedTheme + data-theme', async () => {
    mockMatchMedia(false);
    const { useThemeStore } = await import('./themeStore');
    useThemeStore.getState().setMode('dark');
    expect(localStorage.getItem('theme-mode')).toBe('dark');
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  test('subscribes to matchMedia changes only in system mode', async () => {
    const { hasListener } = mockMatchMedia(false);
    const { useThemeStore } = await import('./themeStore');
    expect(hasListener()).toBe(true);
    useThemeStore.getState().setMode('light');
    expect(hasListener()).toBe(false);
  });

  test('a live OS theme change updates resolvedTheme while in system mode', async () => {
    const { fireChange } = mockMatchMedia(false);
    const { useThemeStore } = await import('./themeStore');
    fireChange(true);
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  test('re-entering system mode re-subscribes and re-resolves from the current OS state', async () => {
    const { hasListener } = mockMatchMedia(true);
    const { useThemeStore } = await import('./themeStore');
    useThemeStore.getState().setMode('light');
    useThemeStore.getState().setMode('system');
    expect(hasListener()).toBe(true);
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
  });
});
