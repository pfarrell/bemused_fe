import { render, screen } from '@testing-library/react';
import ContextMenu from './ContextMenu';

test('falsy children do not inflate the height calculation', () => {
  // Verify that Children.toArray().filter(Boolean) is being used instead of
  // Children.count(), which would incorrectly count falsy children (like the
  // result of `isAuthenticated && <button>` when false).
  render(
    <ContextMenu
      open={true}
      position={{ x: 10, y: 10 }}
      onDismiss={vi.fn()}
      onSwallowTouch={vi.fn()}
    >
      <button key="a">Button A</button>
      {false}
      <button key="b">Button B</button>
      {null}
      <button key="c">Button C</button>
      {undefined}
    </ContextMenu>
  );

  // Component portals to document.body, find the menu there
  const menu = document.querySelector('.track-dropdown');
  expect(menu).toBeInTheDocument();

  // Verify only 3 buttons rendered (not 6 with falsy children counted)
  const buttons = menu.querySelectorAll('button');
  expect(buttons).toHaveLength(3);
});

test('menu clamps left position to stay on-screen', () => {
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

  render(
    <ContextMenu
      open={true}
      position={{ x: 900, y: 100 }}
      onDismiss={vi.fn()}
      onSwallowTouch={vi.fn()}
    >
      <button key="a">A</button>
      <button key="b">B</button>
    </ContextMenu>
  );

  const menu = document.querySelector('.track-dropdown');
  const style = window.getComputedStyle(menu);
  const left = parseInt(style.left);

  // Menu should be clamped when it would exceed window width
  // 900 + 200 (MENU_WIDTH) = 1100 > 1024, so left should be 1024 - 200 - 10 = 814
  expect(left).toBe(814);
});

test('renders null when open is false', () => {
  render(
    <ContextMenu
      open={false}
      position={{ x: 10, y: 10 }}
      onDismiss={vi.fn()}
      onSwallowTouch={vi.fn()}
    >
      <button>Button</button>
    </ContextMenu>
  );

  // When open is false, component returns null and doesn't render anything to document.body
  expect(document.querySelector('.track-dropdown')).not.toBeInTheDocument();
});

test('uses custom testId on backdrop', () => {
  render(
    <ContextMenu
      open={true}
      position={{ x: 10, y: 10 }}
      onDismiss={vi.fn()}
      onSwallowTouch={vi.fn()}
      testId="my-custom-backdrop"
    >
      <button>Button</button>
    </ContextMenu>
  );

  expect(screen.getByTestId('my-custom-backdrop')).toBeInTheDocument();
});
