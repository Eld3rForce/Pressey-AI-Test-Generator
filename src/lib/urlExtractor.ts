// URL extraction utilities for the prompt-driven ingestion feature.

const URL_REGEX = /https?:\/\/[^\s<>"'`)\]]+/g;
const TRAILING_PUNCT = /[.,;)\]]+$/;

export function normalizeUrl(url: string): string {
  let normalized = url.trim();
  // Lowercase scheme + host
  const match = normalized.match(/^(https?:\/\/)([^/]+)(.*)$/i);
  if (match) {
    const [, scheme, host, rest] = match;
    normalized = `${scheme.toLowerCase()}${host.toLowerCase()}${rest}`;
  }
  // Strip trailing slash if path is not just "/"
  const schemeEnd = normalized.indexOf('//') + 2;
  const lastSlash = normalized.lastIndexOf('/');
  if (normalized.endsWith('/') && lastSlash > schemeEnd) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) ?? [];
  const cleaned = matches
    .map((u) => u.replace(TRAILING_PUNCT, ''))
    .filter((u) => /^https?:\/\//i.test(u))
    .filter((u) => {
      const lower = u.toLowerCase();
      return !lower.startsWith('javascript:') && !lower.startsWith('data:');
    });

  // Dedupe by normalized form
  const seen = new Set<string>();
  const result: string[] = [];
  for (const u of cleaned) {
    const norm = normalizeUrl(u);
    if (!seen.has(norm)) {
      seen.add(norm);
      result.push(u);
    }
  }
  return result;
}

export function isPdfUrl(url: string): boolean {
  // Strip query string and fragment for extension check
  const path = url.split('?')[0].split('#')[0];
  return /\.pdf$/i.test(path);
}
