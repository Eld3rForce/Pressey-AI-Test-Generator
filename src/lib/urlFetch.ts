// HTML URL fetch and content extraction via @mozilla/readability.
import { Readability } from '@mozilla/readability';
import { ErrorCodes } from './errorUtils';
import type { Settings } from './types';

export interface UrlFetchResult {
  url: string;
  title: string;
  content: string;
  contentLength: number;
}

const MAX_TIMEOUT_MS = 30_000;

function logWarn(code: string, message: string): void {
  console.warn(`[urlFetch] ${code}: ${message}`);
}

function isPdfUrl(url: string): boolean {
  const path = url.split('?')[0].split('#')[0];
  return /\.pdf$/i.test(path);
}

export async function fetchAndExtractUrl(
  url: string,
  settings: Settings
): Promise<UrlFetchResult | null> {
  // PDF URLs go through Rust, not browser fetch
  if (isPdfUrl(url)) {
    logWarn(ErrorCodes.URL_FETCH_INVALID_URL, 'PDF URL passed to browser fetch');
    return null;
  }

  const maxBytes = settings.urlFetchMaxBytesPerUrl ?? 2_000_000;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MAX_TIMEOUT_MS);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      logWarn(ErrorCodes.URL_FETCH_FAILED, `HTTP ${response.status}`);
      return null;
    }

    // Check content-length header
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      logWarn(ErrorCodes.URL_FETCH_TOO_LARGE, `Response ${contentLength} exceeds ${maxBytes}`);
      return null;
    }

    const html = await response.text();
    if (html.length > maxBytes) {
      logWarn(ErrorCodes.URL_FETCH_TOO_LARGE, `Body ${html.length} exceeds ${maxBytes}`);
      return null;
    }

    // Parse HTML and extract via Readability (clone before passing — parse() mutates)
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const reader = new Readability(doc.cloneNode(true) as unknown as Document);
    const article = reader.parse();

    if (!article || !article.textContent) {
      logWarn(ErrorCodes.URL_FETCH_PARSE_FAILED, 'Readability returned null');
      return null;
    }

    return {
      url,
      title: article.title ?? '',
      content: article.textContent,
      contentLength: article.textContent.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes('abort') || message.toLowerCase().includes('timeout')) {
      logWarn(ErrorCodes.URL_FETCH_TIMEOUT, message);
    } else {
      logWarn(ErrorCodes.URL_FETCH_FAILED, message);
    }
    return null;
  }
}

export async function fetchAndExtractUrls(
  urls: string[],
  settings: Settings
): Promise<UrlFetchResult[]> {
  if (urls.length === 0) return [];

  const maxResults = settings.urlFetchMaxResults ?? 5;
  const limited = urls.slice(0, maxResults);

  const results = await Promise.all(
    limited.map((url) => fetchAndExtractUrl(url, settings))
  );
  return results.filter((r): r is UrlFetchResult => r !== null);
}

export function buildUrlFetchContext(results: UrlFetchResult[]): string {
  if (results.length === 0) return '';

  const blocks = results.map(
    (r, i) => `[URL ${i + 1}] ${r.title}\n${r.content}\nSource: ${r.url}`
  );
  return `URL CONTEXT:\n${blocks.join('\n\n')}`;
}
