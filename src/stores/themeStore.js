import { create } from 'zustand';

const STORAGE_KEY = 'theme-mode';
const media = window.matchMedia('(prefers-color-scheme: dark)');
let listenerAttached = false;

function resolveTheme(mode) {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  return media.matches ? 'dark' : 'light';
}

function applyTheme(resolvedTheme) {
  document.documentElement.setAttribute('data-theme', resolvedTheme);
}

function handleMediaChange() {
  const { mode } = useThemeStore.getState();
  if (mode !== 'system') return;
  const resolvedTheme = resolveTheme(mode);
  applyTheme(resolvedTheme);
  useThemeStore.setState({ resolvedTheme });
}

function syncMediaListener(mode) {
  if (mode === 'system' && !listenerAttached) {
    media.addEventListener('change', handleMediaChange);
    listenerAttached = true;
  } else if (mode !== 'system' && listenerAttached) {
    media.removeEventListener('change', handleMediaChange);
    listenerAttached = false;
  }
}

const initialMode = localStorage.getItem(STORAGE_KEY) ?? 'system';
const initialResolved = resolveTheme(initialMode);
applyTheme(initialResolved);
syncMediaListener(initialMode);

export const useThemeStore = create((set) => ({
  mode: initialMode,
  resolvedTheme: initialResolved,
  setMode: (mode) => {
    localStorage.setItem(STORAGE_KEY, mode);
    const resolvedTheme = resolveTheme(mode);
    applyTheme(resolvedTheme);
    syncMediaListener(mode);
    set({ mode, resolvedTheme });
  },
}));
