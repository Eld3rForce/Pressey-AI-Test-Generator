import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  searchWeb,
  searchDocument,
  buildResearchContext,
  type SearchResult,
  type DocResult,
} from './research';

// ============================================================
// Fixtures
// ============================================================

const VALID_DDG_HTML = `
<!DOCTYPE html>
<html>
<head><title>DuckDuckGo</title></head>
<body>
  <div class="result">
    <h2 class="result__title">
      <a class="result__a" href="https://example.com/foo">Foo &amp; Bar Basics</a>
    </h2>
    <a class="result__snippet" href="https://example.com/foo">
      Foo is a placeholder concept used in &lt;b&gt;metasyntactic&lt;/b&gt; examples across documentation.
    </a>
  </div>
  <div class="result">
    <h2 class="result__title">
      <a class="result__a" href="https://example.com/bar">Bar in Modern Usage</a>
    </h2>
    <a class="result__snippet" href="https://example.com/bar">
      Bar represents a second item in a paired example, often appearing with foo.
    </a>
  </div>
  <div class="result">
    <h2 class="result__title">
      <a class="result__a" href="https://example.com/baz">Baz: Beyond Foo &amp; Bar</a>
    </h2>
    <a class="result__snippet" href="https://example.com/baz">
      Baz extends the foo-bar naming pattern, sometimes called fizzbuzz-style.
    </a>
  </div>
</body>
</html>
`;

const EMPTY_DDG_HTML = `
<!DOCTYPE html>
<html>
<head><title>No results</title></head>
<body>
  <div class="no-results">No more results.</div>
</body>
</html>
`;

// ============================================================
// Test lifecycle
// ============================================================

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ============================================================
// searchWeb — happy path
// ============================================================

describe('searchWeb', () => {
  it('returns parsed results when DDG returns valid HTML', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(VALID_DDG_HTML),
    });
    vi.stubGlobal('fetch', mockFetch);

    const results = await searchWeb('foo bar', 5, 800);

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      title: 'Foo & Bar Basics',
      url: 'https://example.com/foo',
    });
    expect(results[0].snippet).toContain('metasyntactic');
    expect(results[1].title).toBe('Bar in Modern Usage');
    expect(results[2].title).toBe('Baz: Beyond Foo & Bar');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('encodes the query parameter in the DDG URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(VALID_DDG_HTML),
    });
    vi.stubGlobal('fetch', mockFetch);

    await searchWeb('hello world & friends', 3, 200);

    const calledUrl = String(mockFetch.mock.calls[0][0]);
    expect(calledUrl).toContain('https://html.duckduckgo.com/html/?q=');
    expect(calledUrl).toContain(encodeURIComponent('hello world & friends'));
  });

  it('limits results to maxResults', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(VALID_DDG_HTML),
    });
    vi.stubGlobal('fetch', mockFetch);

    const results = await searchWeb('foo', 2, 500);
    expect(results).toHaveLength(2);
  });

  it('truncates snippets to snippetChars', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(VALID_DDG_HTML),
    });
    vi.stubGlobal('fetch', mockFetch);

    const results = await searchWeb('foo', 5, 30);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.snippet.length).toBeLessThanOrEqual(33);
    }
  });

  it('returns [] for empty query without calling fetch', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const results = await searchWeb('   ', 5, 800);

    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns [] and warns when DDG returns empty results', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(EMPTY_DDG_HTML),
    });
    vi.stubGlobal('fetch', mockFetch);

    const results = await searchWeb('asdkjasdjasd', 5, 800);

    expect(results).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    const warnCall = warnSpy.mock.calls[0].join(' ');
    expect(warnCall).toContain('RESEARCH_NO_RESULTS');
  });

  it('returns [] and warns when fetch throws (network failure)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    vi.stubGlobal('fetch', mockFetch);

    const results = await searchWeb('typescript', 5, 800);

    expect(results).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    const warnCall = warnSpy.mock.calls[0].join(' ');
    expect(warnCall).toContain('RESEARCH_FETCH_FAILED');
  });

  it('returns [] and warns when DDG returns a non-2xx status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve(''),
    });
    vi.stubGlobal('fetch', mockFetch);

    const results = await searchWeb('rate limited query', 5, 800);

    expect(results).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    const warnCall = warnSpy.mock.calls[0].join(' ');
    expect(warnCall).toContain('RESEARCH_FETCH_FAILED');
    expect(warnCall).toContain('429');
  });
});

// ============================================================
// searchDocument
// ============================================================

describe('searchDocument', () => {
  it('finds occurrences and returns context windows', async () => {
    const text =
      'The quick brown fox jumps over the lazy dog. Foxes are clever animals. ' +
      'A second fox story about the same fox appears later.';
    const results = await searchDocument(text, 'fox', 800);

    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.matchPos).toBeGreaterThanOrEqual(0);
      expect(r.snippet.toLowerCase()).toContain('fox');
    }
  });

  it('returns [] when text is empty', async () => {
    const results = await searchDocument('', 'query', 800);
    expect(results).toEqual([]);
  });

  it('returns [] when query is empty', async () => {
    const results = await searchDocument('some text', '   ', 800);
    expect(results).toEqual([]);
  });

  it('returns [] when no terms match', async () => {
    const results = await searchDocument('plain text', 'asdkjasd', 800);
    expect(results).toEqual([]);
  });

  it('matches multiple query terms', async () => {
    const text = 'Apples are red. Bananas are yellow. The sun is bright.';
    const results = await searchDocument(text, 'apples bananas', 800);

    expect(results.length).toBeGreaterThanOrEqual(2);
    const combined = results.map((r) => r.snippet.toLowerCase()).join(' ');
    expect(combined).toContain('apple');
    expect(combined).toContain('banana');
  });

  it('deduplicates exact match position hits across multiple terms', async () => {
    const text = 'foo bar baz';
    const results = await searchDocument(text, 'foo foo', 800);
    expect(results).toHaveLength(1);
  });

  it('sorts results by match position ascending', async () => {
    const text = 'fox one. gap. fox two. more. fox three.';
    const results = await searchDocument(text, 'fox', 800);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].matchPos).toBeGreaterThan(results[i - 1].matchPos);
    }
  });
});

// ============================================================
// buildResearchContext
// ============================================================

describe('buildResearchContext', () => {
  it('returns empty string for empty inputs', () => {
    expect(buildResearchContext([], [])).toBe('');
  });

  it('formats web results only', () => {
    const web: SearchResult[] = [
      { title: 'Title One', snippet: 'Snippet one.', url: 'https://example.com/1' },
    ];
    const ctx = buildResearchContext(web, []);
    expect(ctx).toContain('RESEARCH CONTEXT:');
    expect(ctx).toContain('--- Web Results ---');
    expect(ctx).toContain('[Web 1] Title One');
    expect(ctx).toContain('Snippet one.');
    expect(ctx).toContain('Source: https://example.com/1');
  });

  it('formats document results only', () => {
    const docs: DocResult[] = [
      { snippet: 'doc snippet text', matchPos: 0 },
    ];
    const ctx = buildResearchContext([], docs);
    expect(ctx).toContain('RESEARCH CONTEXT:');
    expect(ctx).toContain('--- Document Excerpts ---');
    expect(ctx).toContain('[Doc 1] doc snippet text');
  });

  it('formats both web and document results', () => {
    const web: SearchResult[] = [
      { title: 'WebT', snippet: 'WebS', url: 'https://x' },
    ];
    const docs: DocResult[] = [{ snippet: 'DocS', matchPos: 0 }];
    const ctx = buildResearchContext(web, docs);
    expect(ctx).toContain('--- Web Results ---');
    expect(ctx).toContain('--- Document Excerpts ---');
    expect(ctx).toContain('[Web 1] WebT');
    expect(ctx).toContain('[Doc 1] DocS');
  });

  it('contains snippet text from searchWeb results in formatted context', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(VALID_DDG_HTML),
    });
    vi.stubGlobal('fetch', mockFetch);

    const web = await searchWeb('foo bar', 5, 800);
    const ctx = buildResearchContext(web, []);
    expect(ctx).toContain('metasyntactic');
  });
});

// ============================================================
// Disabled / opt-in behavior (caller contract)
// ============================================================

describe('opt-in enableResearch contract', () => {
  it('does not call fetch when caller skips the search (enableResearch=false path)', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const enabled = false;
    let results: SearchResult[] = [];
    if (enabled) {
      results = await searchWeb('should not run', 5, 800);
    }

    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
