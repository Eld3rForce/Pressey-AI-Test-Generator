import { describe, it, expect } from 'vitest';
import { UrlFetchResultSchema, PdfFetchResultSchema } from './schemas';

// ============================================================
// UrlFetchResultSchema
// ============================================================

describe('UrlFetchResultSchema', () => {
  it('validates a valid URL fetch result', () => {
    const result = UrlFetchResultSchema.safeParse({
      url: 'https://example.com',
      title: 'Example Title',
      content: 'Example content',
      contentLength: 100,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid URL', () => {
    const result = UrlFetchResultSchema.safeParse({
      url: 'not-a-url',
      title: 'T',
      content: 'C',
      contentLength: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative contentLength', () => {
    const result = UrlFetchResultSchema.safeParse({
      url: 'https://example.com',
      title: 'T',
      content: 'C',
      contentLength: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = UrlFetchResultSchema.safeParse({
      url: 'https://example.com',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// PdfFetchResultSchema
// ============================================================

describe('PdfFetchResultSchema', () => {
  it('validates a valid PDF fetch result', () => {
    const result = PdfFetchResultSchema.safeParse({
      url: 'https://example.com/file.pdf',
      content: 'Extracted text',
      pageCount: 5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid URL', () => {
    const result = PdfFetchResultSchema.safeParse({
      url: 'bad',
      content: 'C',
      pageCount: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero pageCount', () => {
    const result = PdfFetchResultSchema.safeParse({
      url: 'https://example.com/file.pdf',
      content: 'C',
      pageCount: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative pageCount', () => {
    const result = PdfFetchResultSchema.safeParse({
      url: 'https://example.com/file.pdf',
      content: 'C',
      pageCount: -3,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = PdfFetchResultSchema.safeParse({
      url: 'https://example.com/file.pdf',
    });
    expect(result.success).toBe(false);
  });
});
