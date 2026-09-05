import { safeReturnTo } from './returnTo';

describe('safeReturnTo', () => {
  test('accepts a same-site relative path', () => {
    expect(safeReturnTo('/overtone/entity/123')).toBe('/overtone/entity/123');
  });

  test('rejects a protocol-relative URL (open-redirect guard)', () => {
    expect(safeReturnTo('//evil.example.com')).toBeNull();
  });

  test('rejects a value that does not start with a slash', () => {
    expect(safeReturnTo('evil.example.com')).toBeNull();
  });

  test('rejects null and empty string', () => {
    expect(safeReturnTo(null)).toBeNull();
    expect(safeReturnTo('')).toBeNull();
  });
});
