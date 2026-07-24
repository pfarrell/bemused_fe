import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from './useIsMobile';

const setInnerWidth = (value) => {
  Object.defineProperty(window, 'innerWidth', { value, configurable: true });
};

afterEach(() => {
  setInnerWidth(1024);
});

test('returns true when the window is at or below the breakpoint', () => {
  setInnerWidth(500);
  const { result } = renderHook(() => useIsMobile());
  expect(result.current).toBe(true);
});

test('returns false when the window is above the breakpoint', () => {
  setInnerWidth(1024);
  const { result } = renderHook(() => useIsMobile());
  expect(result.current).toBe(false);
});

test('updates when the window is resized past the breakpoint', () => {
  setInnerWidth(1024);
  const { result } = renderHook(() => useIsMobile());
  expect(result.current).toBe(false);

  act(() => {
    setInnerWidth(500);
    window.dispatchEvent(new Event('resize'));
  });

  expect(result.current).toBe(true);
});

test('respects a custom breakpoint', () => {
  setInnerWidth(900);
  const { result } = renderHook(() => useIsMobile(1024));
  expect(result.current).toBe(true);
});
