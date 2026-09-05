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

  test('rejects a backslash-based host bypass (open-redirect guard)', () => {
    // Browsers fold a leading "\" into "/" during URL parsing, so a naive
    // string-prefix check lets this resolve to https://evil.example.com/
    // once assigned to window.location.href.
    expect(safeReturnTo('/\\evil.example.com')).toBeNull();
  });

  test('rejects a tab-obfuscated host bypass (open-redirect guard)', () => {
    // Browsers strip tab/CR/LF characters before parsing, so a naive
    // string-prefix check lets this resolve to https://evil.example.com/
    // once assigned to window.location.href.
    expect(safeReturnTo('/\t/evil.example.com')).toBeNull();
  });
});
