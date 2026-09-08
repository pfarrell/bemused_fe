import '@testing-library/jest-dom';

// jsdom does not implement matchMedia; themeStore calls it at module-load
// time to resolve the "system" theme preference.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  });
}
