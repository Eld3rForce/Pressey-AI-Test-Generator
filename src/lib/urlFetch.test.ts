import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAndExtractUrl, fetchAndExtractUrls, buildUrlFetchContext } from './urlFetch';
import type { Settings } from './types';

// Mock @mozilla/readability so tests don't depend on jsdom HTML parsing
vi.mock('@mozilla/readability', () => ({
  Readability: vi.fn().mockImplementation(() => ({
    parse: vi.fn().mockReturnValue({
      title: 'Mocked Title',
      textContent: 'Mocked text content',
    }),
  })),
}));

const baseSettings: Settings = {
  apiKey: 'test-key',
  model: 'test-model',
  defaultQuestionCount: 5,
  defaultMcqPercentage: 50,
  defaultDifficulty: 'Easy',
  enableUrlFetch: true,
  urlFetchMaxResults: 5,
  urlFetchMaxBytesPerUrl: 2_000_000,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchAndExtractUrl', () => {
  it('returns UrlFetchResult on successful fetch', async () => {
    const html = '<html><body><h1>Title</h1><p>Content</p></body></html>';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': String(html.length) }),
      text: () => Promise.resolve(html),
    }));
    const result = await fetchAndExtractUrl('https://example.com', baseSettings);
    expect(result).not.toBeNull();
    expect(result?.url).toBe('https://example.com');
    expect(result?.title).toBe('Mocked Title');
    expect(result?.content).toBe('Mocked text content');
  });

  it('returns null on 404', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));
    const result = await fetchAndExtractUrl('https://x.com', baseSettings);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('URL_FETCH_FAILED'));
    warnSpy.mockRestore();
  });

  it('returns null on network error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));
    const result = await fetchAndExtractUrl('https://x.com', baseSettings);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('URL_FETCH_FAILED'));
    warnSpy.mockRestore();
  });

  it('returns null on too-large response (content-length)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': '10000000' }),
    }));
    const result = await fetchAndExtractUrl('https://x.com', baseSettings);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('URL_FETCH_TOO_LARGE'));
    warnSpy.mockRestore();
  });

  it('returns null for PDF URLs (handled by Rust)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await fetchAndExtractUrl('https://x.com/file.pdf', baseSettings);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('URL_FETCH_INVALID_URL'));
    warnSpy.mockRestore();
  });

  it('returns null when Readability parse() returns null', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = '<html><body>nothing</body></html>';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': String(html.length) }),
      text: () => Promise.resolve(html),
    }));
    const { Readability } = await import('@mozilla/readability');
    vi.mocked(Readability).mockImplementationOnce(
      () => ({ parse: () => null }) as unknown as InstanceType<typeof Readability>
    );

    const result = await fetchAndExtractUrl('https://x.com', baseSettings);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('URL_FETCH_PARSE_FAILED'));
    warnSpy.mockRestore();
  });
});

describe('fetchAndExtractUrls', () => {
  it('skips failing URLs and returns successful ones', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = '<html><body><p>X</p></body></html>';
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': String(html.length) }),
          text: () => Promise.resolve(html),
        });
      }
      return Promise.resolve({ ok: false, status: 500, statusText: 'Server Error' });
    }));
    const results = await fetchAndExtractUrls(['https://a.com', 'https://b.com'], baseSettings);
    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe('https://a.com');
    warnSpy.mockRestore();
  });

  it('returns [] for empty input without calling fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const results = await fetchAndExtractUrls([], baseSettings);
    expect(results).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('respects urlFetchMaxResults limit', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = '<html><body><p>X</p></body></html>';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': String(html.length) }),
      text: () => Promise.resolve(html),
    }));
    const settings = { ...baseSettings, urlFetchMaxResults: 2 };
    const results = await fetchAndExtractUrls(
      ['https://a.com', 'https://b.com', 'https://c.com'],
      settings
    );
    expect(results).toHaveLength(2);
    warnSpy.mockRestore();
  });
});

describe('buildUrlFetchContext', () => {
  it('returns empty string for no results', () => {
    expect(buildUrlFetchContext([])).toBe('');
  });

  it('formats results into URL CONTEXT block', () => {
    const out = buildUrlFetchContext([
      { url: 'https://x.com', title: 'X Title', content: 'X Content', contentLength: 8 },
    ]);
    expect(out).toContain('URL CONTEXT:');
    expect(out).toContain('[URL 1]');
    expect(out).toContain('X Title');
    expect(out).toContain('X Content');
    expect(out).toContain('https://x.com');
  });

  it('numbers multiple results', () => {
    const out = buildUrlFetchContext([
      { url: 'https://a.com', title: 'A', content: 'a', contentLength: 1 },
      { url: 'https://b.com', title: 'B', content: 'b', contentLength: 1 },
    ]);
    expect(out).toContain('[URL 1]');
    expect(out).toContain('[URL 2]');
  });
});
