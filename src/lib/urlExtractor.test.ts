import { describe, it, expect } from 'vitest';
import { extractUrls, isPdfUrl, normalizeUrl } from './urlExtractor';

describe('extractUrls', () => {
  it('extracts a basic URL', () => {
    expect(extractUrls('visit https://example.com today'))
      .toEqual(['https://example.com']);
  });
  it('returns empty for no URLs', () => {
    expect(extractUrls('no urls here')).toEqual([]);
  });
  it('extracts multiple URLs', () => {
    expect(extractUrls('https://a.com and https://b.com'))
      .toEqual(['https://a.com', 'https://b.com']);
  });
  it('strips markdown link syntax', () => {
    expect(extractUrls('markdown [link](https://x.com) works'))
      .toEqual(['https://x.com']);
  });
  it('strips angle brackets', () => {
    expect(extractUrls('angle <https://y.com> bracket'))
      .toEqual(['https://y.com']);
  });
  it('strips trailing period', () => {
    expect(extractUrls('https://x.com. trailing'))
      .toEqual(['https://x.com']);
  });
  it('strips trailing paren', () => {
    expect(extractUrls('https://x.com), and more'))
      .toEqual(['https://x.com']);
  });
  it('preserves inner parens in path', () => {
    expect(extractUrls('https://x.com/foo)bar'))
      .toEqual(['https://x.com/foo']);
  });
  it('deduplicates case-insensitive, strips trailing slash', () => {
    expect(extractUrls('same URL twice: https://x.com and HTTPS://X.COM/'))
      .toEqual(['https://x.com']);
  });
  it('rejects javascript: scheme (XSS)', () => {
    expect(extractUrls('javascript:alert(1)')).toEqual([]);
  });
  it('rejects data: URLs', () => {
    expect(extractUrls('data:text/html,hi')).toEqual([]);
  });
  it('allows http private IPs (SSRF allow-all per decision)', () => {
    expect(extractUrls('http://192.168.1.1'))
      .toEqual(['http://192.168.1.1']);
  });
  it('preserves URL with userinfo', () => {
    expect(extractUrls('https://user:pass@host.com'))
      .toEqual(['https://user:pass@host.com']);
  });
  it('preserves IDN URLs', () => {
    expect(extractUrls('https://例え.jp/path'))
      .toEqual(['https://例え.jp/path']);
  });
});

describe('isPdfUrl', () => {
  it('detects .pdf extension', () => {
    expect(isPdfUrl('https://x.com/file.pdf')).toBe(true);
  });
  it('detects .pdf with query string', () => {
    expect(isPdfUrl('https://x.com/file.pdf?query=1')).toBe(true);
  });
  it('rejects non-pdf', () => {
    expect(isPdfUrl('https://x.com/page')).toBe(false);
  });
  it('is case-insensitive', () => {
    expect(isPdfUrl('https://x.com/page.PDF')).toBe(true);
  });
});

describe('normalizeUrl', () => {
  it('lowercases scheme + host', () => {
    expect(normalizeUrl('HTTPS://X.COM/PATH'))
      .toBe('https://x.com/PATH');
  });
  it('strips trailing slash', () => {
    expect(normalizeUrl('https://x.com/path/'))
      .toBe('https://x.com/path');
  });
});
