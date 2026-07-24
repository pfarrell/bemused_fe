import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScrollToTop } from './App';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ScrollToTop />
    </MemoryRouter>
  );
}

describe('ScrollToTop', () => {
  let mainContent;

  beforeEach(() => {
    mainContent = document.createElement('div');
    mainContent.className = 'main-content';
    // jsdom doesn't implement Element.scrollTo.
    mainContent.scrollTo = (x, y) => { mainContent.scrollTop = y ?? (typeof x === 'object' ? x.top : 0) ?? 0; };
    document.body.appendChild(mainContent);
  });

  afterEach(() => {
    mainContent.remove();
  });

  test('resets .main-content scroll on a non-home route', () => {
    mainContent.scrollTop = 300;
    renderAt('/artist/1');
    expect(mainContent.scrollTop).toBe(0);
  });

  test('leaves .main-content scroll untouched on the home route', () => {
    mainContent.scrollTop = 300;
    renderAt('/');
    expect(mainContent.scrollTop).toBe(300);
  });
});
