import { describe, it, expect } from 'vitest';
import { parseWikipediaSlug } from './wikipediaSlug';

describe('parseWikipediaSlug', () => {
  it('passes through a bare slug unchanged', () => {
    expect(parseWikipediaSlug('Some_Article')).toBe('Some_Article');
  });

  it('extracts the slug from a full article URL', () => {
    expect(parseWikipediaSlug('https://en.wikipedia.org/wiki/Some_Article')).toBe('Some_Article');
  });

  it('extracts the slug from a mobile article URL', () => {
    expect(parseWikipediaSlug('https://en.m.wikipedia.org/wiki/Some_Article')).toBe('Some_Article');
  });

  it('preserves a section fragment', () => {
    expect(parseWikipediaSlug('https://en.wikipedia.org/wiki/Some_Article#Section_Name'))
      .toBe('Some_Article#Section_Name');
  });

  it('drops a query string but keeps the fragment', () => {
    expect(parseWikipediaSlug('https://en.wikipedia.org/wiki/Some_Article?action=history#See_also'))
      .toBe('Some_Article#See_also');
  });

  it('decodes percent-encoded characters', () => {
    expect(parseWikipediaSlug('https://en.wikipedia.org/wiki/Caf%C3%A9')).toBe('Café');
  });

  it('trims surrounding whitespace', () => {
    expect(parseWikipediaSlug('  Some_Article  ')).toBe('Some_Article');
  });

  it('leaves non-Wikipedia text unchanged', () => {
    expect(parseWikipediaSlug('https://example.com/wiki/Some_Article')).toBe('https://example.com/wiki/Some_Article');
  });
});
