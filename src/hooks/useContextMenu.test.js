import { renderHook, act } from '@testing-library/react';
import { useContextMenu } from './useContextMenu';

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
});

test('starts closed', () => {
  const { result } = renderHook(() => useContextMenu());
  expect(result.current.open).toBe(false);
});

test('onContextMenu opens the menu at the click position', () => {
  const { result } = renderHook(() => useContextMenu());
  act(() => {
    result.current.triggerProps.onContextMenu({ preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: 40, clientY: 60, target: document.createElement('div') });
  });
  expect(result.current.open).toBe(true);
  expect(result.current.position).toEqual({ x: 40, y: 60 });
});

test('shouldIgnore suppresses onContextMenu', () => {
  const { result } = renderHook(() => useContextMenu({ shouldIgnore: () => true }));
  act(() => {
    result.current.triggerProps.onContextMenu({ preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: 1, clientY: 1, target: document.createElement('div') });
  });
  expect(result.current.open).toBe(false);
});

test('a long-press (500ms touch hold) opens the menu', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useContextMenu());
  act(() => {
    result.current.triggerProps.onTouchStart({ touches: [{ clientX: 10, clientY: 10 }] });
  });
  act(() => { vi.advanceTimersByTime(500); });
  expect(result.current.open).toBe(true);
  vi.useRealTimers();
});

test('moving more than 10px before 500ms cancels the long-press', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useContextMenu());
  act(() => {
    result.current.triggerProps.onTouchStart({ touches: [{ clientX: 10, clientY: 10 }] });
  });
  act(() => {
    result.current.triggerProps.onTouchMove({ touches: [{ clientX: 30, clientY: 10 }] });
  });
  act(() => { vi.advanceTimersByTime(500); });
  expect(result.current.open).toBe(false);
  vi.useRealTimers();
});

test('close() closes an open menu', () => {
  const { result } = renderHook(() => useContextMenu());
  act(() => {
    result.current.triggerProps.onContextMenu({ preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: 1, clientY: 1, target: document.createElement('div') });
  });
  act(() => { result.current.close(); });
  expect(result.current.open).toBe(false);
});

test('dismiss() closes the menu unless it was just opened by a long-press', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useContextMenu());
  act(() => {
    result.current.triggerProps.onTouchStart({ touches: [{ clientX: 10, clientY: 10 }] });
  });
  act(() => { vi.advanceTimersByTime(500); });
  expect(result.current.open).toBe(true);

  // The synthesized click/touchend that follows finger release must not
  // immediately close the menu it just opened.
  act(() => {
    result.current.dismiss({ preventDefault: vi.fn(), stopPropagation: vi.fn() });
  });
  expect(result.current.open).toBe(true);

  vi.useRealTimers();
});
