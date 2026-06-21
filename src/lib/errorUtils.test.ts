import { describe, it, expect } from 'vitest';
import { ErrorCodes } from './errorUtils';

describe('ErrorCodes - URL fetch and PDF', () => {
  it('has URL_FETCH_FAILED', () => {
    expect(ErrorCodes.URL_FETCH_FAILED).toBeTruthy();
    expect(typeof ErrorCodes.URL_FETCH_FAILED).toBe('string');
  });

  it('has URL_FETCH_TIMEOUT', () => {
    expect(ErrorCodes.URL_FETCH_TIMEOUT).toBeTruthy();
    expect(typeof ErrorCodes.URL_FETCH_TIMEOUT).toBe('string');
  });

  it('has URL_FETCH_PARSE_FAILED', () => {
    expect(ErrorCodes.URL_FETCH_PARSE_FAILED).toBeTruthy();
    expect(typeof ErrorCodes.URL_FETCH_PARSE_FAILED).toBe('string');
  });

  it('has URL_FETCH_TOO_LARGE', () => {
    expect(ErrorCodes.URL_FETCH_TOO_LARGE).toBeTruthy();
    expect(typeof ErrorCodes.URL_FETCH_TOO_LARGE).toBe('string');
  });

  it('has URL_FETCH_INVALID_URL', () => {
    expect(ErrorCodes.URL_FETCH_INVALID_URL).toBeTruthy();
    expect(typeof ErrorCodes.URL_FETCH_INVALID_URL).toBe('string');
  });

  it('has PDF_FETCH_FAILED', () => {
    expect(ErrorCodes.PDF_FETCH_FAILED).toBeTruthy();
    expect(typeof ErrorCodes.PDF_FETCH_FAILED).toBe('string');
  });

  it('has PDF_EXTRACT_FAILED', () => {
    expect(ErrorCodes.PDF_EXTRACT_FAILED).toBeTruthy();
    expect(typeof ErrorCodes.PDF_EXTRACT_FAILED).toBe('string');
  });
});
