import { describe, expect, it } from 'vitest';
import { isPlainLeftClick } from './tabBridgeProtocol';

const PLAIN = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

describe('isPlainLeftClick', () => {
  it('returns true for an unmodified left click', () => {
    expect(isPlainLeftClick(PLAIN)).toBe(true);
  });

  it('returns false for a non-primary button', () => {
    expect(isPlainLeftClick({ ...PLAIN, button: 1 })).toBe(false);
  });

  it.each(['metaKey', 'ctrlKey', 'shiftKey', 'altKey'])('returns false when %s is held', (key) => {
    expect(isPlainLeftClick({ ...PLAIN, [key]: true })).toBe(false);
  });
});
