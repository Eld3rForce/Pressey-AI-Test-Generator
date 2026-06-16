// ============================================================
// Research module — web search via DuckDuckGo HTML + document search
// ============================================================
// Provides opt-in research context for prompt enrichment.
// Gracefully degrades on any failure: returns [] / '' and logs a
// warning rather than throwing, so callers can always proceed.
// ============================================================

import { ErrorCodes } from './errorUtils';
import { ResearchResultSchema, ResearchDocResultSchema } from './schemas';

// ============================================================
// Public types
// ============================================================

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export interface DocResult {
  snippet: string;
  matchPos: number;
}

// ============================================================
// Constants
// ============================================================

const DDG_ENDPOINT = 'https://html.duckduckgo.com/html/';
const DEFAULT_DOC_CONTEXT_CHARS = 200;
const MAX_DOC_RESULTS = 20;

// ============================================================
// Helpers
// ============================================================

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)));
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ''));
}

function truncate(text: string, max: number): string {
  if (max <= 0) return '';
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '...';
}

function logWarn(code: string, message: string, detail?: unknown): void {
  if (detail !== undefined) {
    console.warn(`[research] ${code}: ${message}`, detail);
  } else {
    console.warn(`[research] ${code}: ${message}`);
  }
}

// ============================================================
// DuckDuckGo HTML parsing
// ============================================================

/**
 * Parse DuckDuckGo HTML response and extract result blocks.
 * Uses DOMParser when available (browser / jsdom); falls back to
 * regex extraction if DOMParser is missing (e.g. minimal Node env).
 */
function parseDdgHtml(html: string): SearchResult[] {
  const dom: DOMParser | undefined =
    typeof DOMParser !== 'undefined' ? new DOMParser() : undefined;

  if (dom) {
    const doc = dom.parseFromString(html, 'text/html');
    const anchors = doc.querySelectorAll('a.result__a');
    if (anchors.length === 0) return [];
    const results: SearchResult[] = [];
    anchors.forEach((a) => {
      const titleEl = a as HTMLAnchorElement;
      const container = titleEl.closest('.result, .web-result, .links_main') ?? titleEl.parentElement;
      const containerHtml = container?.innerHTML ?? '';
      const containerText = container?.textContent ?? '';
      const titleText = titleEl.textContent?.trim() ?? '';
      const href = titleEl.getAttribute('href') ?? '';
      const snippetMatch = containerHtml.match(
        /<a[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/i
      );
      const rawSnippet = snippetMatch ? snippetMatch[1] : containerText;
      const snippet = stripTags(rawSnippet).replace(/\s+/g, ' ').trim();
      if (!titleText || !href) return;
      results.push({ title: titleText, snippet, url: href });
    });
    return results;
  }

  // Regex fallback (used when DOMParser is unavailable).
  const results: SearchResult[] = [];
  const resultRegex =
    /<a[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = resultRegex.exec(html)) !== null) {
    const url = match[1];
    const title = stripTags(match[2]).replace(/\s+/g, ' ').trim();
    const snippet = stripTags(match[3]).replace(/\s+/g, ' ').trim();
    if (title && url) results.push({ title, snippet, url });
  }
  return results;
}

// ============================================================
// searchWeb
// ============================================================

/**
 * Search the web using DuckDuckGo's HTML endpoint (no API key).
 *
 * On any failure (network error, non-2xx, parse error, empty results)
 * returns [] and logs a warning. Never throws.
 */
export async function searchWeb(
  query: string,
  maxResults: number,
  snippetChars: number
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const limit = Math.max(1, Math.floor(maxResults));
  const cap = Math.max(1, Math.floor(snippetChars));

  const url = `${DDG_ENDPOINT}?q=${encodeURIComponent(trimmed)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/html' },
    });
  } catch (err) {
    logWarn(
      ErrorCodes.RESEARCH_FETCH_FAILED,
      `Network error while searching web for "${trimmed}"`,
      err
    );
    return [];
  }

  if (!response.ok) {
    logWarn(
      ErrorCodes.RESEARCH_FETCH_FAILED,
      `Web search returned HTTP ${response.status} for "${trimmed}"`
    );
    return [];
  }

  let html: string;
  try {
    html = await response.text();
  } catch (err) {
    logWarn(
      ErrorCodes.RESEARCH_PARSE_FAILED,
      `Failed to read web search response body for "${trimmed}"`,
      err
    );
    return [];
  }

  let parsed: SearchResult[];
  try {
    parsed = parseDdgHtml(html);
  } catch (err) {
    logWarn(
      ErrorCodes.RESEARCH_PARSE_FAILED,
      `Failed to parse DuckDuckGo HTML response for "${trimmed}"`,
      err
    );
    return [];
  }

  if (parsed.length === 0) {
    logWarn(
      ErrorCodes.RESEARCH_NO_RESULTS,
      `No results found for web search "${trimmed}"`
    );
    return [];
  }

  const capped = parsed.slice(0, limit).map((r) => ({
    title: truncate(r.title, Math.min(200, cap)),
    snippet: truncate(r.snippet, cap),
    url: r.url,
  }));

  const validated: SearchResult[] = [];
  for (const r of capped) {
    const v = ResearchResultSchema.safeParse(r);
    if (v.success) validated.push(v.data);
  }
  return validated;
}

// ============================================================
// searchDocument
// ============================================================

/**
 * Find occurrences of query terms in uploaded text.
 * Returns surrounding context windows for each match.
 * Never throws; returns [] for empty / invalid inputs.
 */
export async function searchDocument(
  text: string,
  query: string,
  snippetChars: number
): Promise<DocResult[]> {
  const docText = text ?? '';
  const trimmedQuery = query.trim();
  if (!docText || !trimmedQuery) return [];

  const cap = Math.max(20, Math.floor(snippetChars));
  const contextWindow = Math.max(20, Math.min(cap, DEFAULT_DOC_CONTEXT_CHARS));

  const terms = trimmedQuery
    .split(/\s+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 2);
  if (terms.length === 0) return [];

  const lower = docText.toLowerCase();
  const seen = new Set<number>();
  const results: DocResult[] = [];

  for (const term of terms) {
    let from = 0;
    while (true) {
      const idx = lower.indexOf(term, from);
      if (idx === -1) break;
      from = idx + term.length;
      if (seen.has(idx)) continue;
      seen.add(idx);

      const start = Math.max(0, idx - contextWindow);
      const end = Math.min(docText.length, idx + term.length + contextWindow);
      const raw = docText.slice(start, end);
      const prefix = start > 0 ? '...' : '';
      const suffix = end < docText.length ? '...' : '';
      const snippet = prefix + raw.replace(/\s+/g, ' ').trim() + suffix;
      results.push({ snippet, matchPos: idx });
      if (results.length >= MAX_DOC_RESULTS) break;
    }
    if (results.length >= MAX_DOC_RESULTS) break;
  }

  results.sort((a, b) => a.matchPos - b.matchPos);

  const validated: DocResult[] = [];
  for (const r of results) {
    const v = ResearchDocResultSchema.safeParse(r);
    if (v.success) validated.push(v.data);
  }
  return validated;
}

// ============================================================
// buildResearchContext
// ============================================================

/**
 * Format web and document results into a single prompt context block.
 * Returns an empty string when there is nothing to add so callers
 * can safely concatenate without a leading newline.
 */
export function buildResearchContext(
  web: SearchResult[],
  docs: DocResult[]
): string {
  const hasWeb = Array.isArray(web) && web.length > 0;
  const hasDocs = Array.isArray(docs) && docs.length > 0;
  if (!hasWeb && !hasDocs) return '';

  const sections: string[] = [];
  sections.push('RESEARCH CONTEXT:');

  if (hasWeb) {
    sections.push('');
    sections.push('--- Web Results ---');
    web.forEach((r, i) => {
      sections.push(`[Web ${i + 1}] ${r.title}`);
      sections.push(r.snippet);
      if (r.url) sections.push(`Source: ${r.url}`);
      sections.push('');
    });
  }

  if (hasDocs) {
    sections.push('--- Document Excerpts ---');
    docs.forEach((r, i) => {
      sections.push(`[Doc ${i + 1}] ${r.snippet}`);
      sections.push('');
    });
  }

  return sections.join('\n').trimEnd();
}
