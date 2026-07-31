import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useIsCurrentPage } from './useIsCurrentPage';

const renderAt = (route, path) =>
  renderHook(() => useIsCurrentPage(path), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>,
  });

test('returns true when path matches the current location', () => {
  const { result } = renderAt('/album/10', '/album/10');
  expect(result.current).toBe(true);
});

test('returns false when path does not match the current location', () => {
  const { result } = renderAt('/album/10', '/album/11');
  expect(result.current).toBe(false);
});

test('returns false when path is null', () => {
  const { result } = renderAt('/album/10', null);
  expect(result.current).toBe(false);
});
