import { describe, it, expect } from 'vitest';
import {
  createApiError,
  isApiError,
  classifyError,
  shouldRetry,
  mapApiError,
  validateApiKey,
  validateQuestionCount,
  validateMcqPercentage,
  validatePrompt,
  validateDifficulty,
  validateToggles,
  validateProvider,
  validateProviderKey,
  ErrorCodes,
  MAX_RETRIES,
  BACKOFF_DELAYS,
} from './errorUtils';
import type { ApiError, ProviderType, Settings } from './types';

// ============================================================
// createApiError
// ============================================================

describe('createApiError', () => {
  it('should create a minimal ApiError with code and message', () => {
    const err = createApiError('TEST_CODE', 'Test message');
    expect(err).toEqual({ code: 'TEST_CODE', message: 'Test message' });
  });

  it('should include optional status', () => {
    const err = createApiError('TEST_CODE', 'Test message', 500);
    expect(err).toEqual({ code: 'TEST_CODE', message: 'Test message', status: 500 });
  });

  it('should attach original error for debugging', () => {
    const original = new Error('original');
    const err = createApiError('TEST_CODE', 'Wrapped', undefined, original);
    expect(err.code).toBe('TEST_CODE');
    expect(err.message).toBe('Wrapped');
    expect((err as ApiError & { original?: unknown }).original).toBe(original);
  });
});

// ============================================================
// isApiError
// ============================================================

describe('isApiError', () => {
  it('should return true for valid ApiError objects', () => {
    expect(isApiError({ code: 'TEST', message: 'msg' })).toBe(true);
    expect(isApiError({ code: 'TEST', message: 'msg', status: 404 })).toBe(true);
  });

  it('should return false for Error instances', () => {
    expect(isApiError(new Error('test'))).toBe(false);
  });

  it('should return false for objects missing code or message', () => {
    expect(isApiError({ message: 'msg' })).toBe(false);
    expect(isApiError({ code: 'TEST' })).toBe(false);
    expect(isApiError({})).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(isApiError(null)).toBe(false);
    expect(isApiError(undefined)).toBe(false);
    expect(isApiError('string')).toBe(false);
    expect(isApiError(42)).toBe(false);
  });

  it('should return false if code is not a string', () => {
    expect(isApiError({ code: 123, message: 'msg' })).toBe(false);
  });
});

// ============================================================
// classifyError
// ============================================================

describe('classifyError', () => {
  it('should pass through existing ApiError objects unchanged', () => {
    const apiErr = createApiError('CUSTOM', 'custom message');
    const result = classifyError(apiErr);
    expect(result).toBe(apiErr);
  });

  it('should classify network errors from Error messages', () => {
    const result = classifyError(new Error('Failed to fetch'));
    expect(result.code).toBe(ErrorCodes.NETWORK_ERROR);
    expect(result.message).toContain('Failed to fetch');
  });

  it('should classify timeout as network error', () => {
    const result = classifyError(new Error('Request timed out'));
    expect(result.code).toBe(ErrorCodes.NETWORK_ERROR);
  });

  it('should classify ECONNREFUSED as network error', () => {
    const result = classifyError(new Error('ECONNREFUSED'));
    expect(result.code).toBe(ErrorCodes.NETWORK_ERROR);
  });

  it('should classify permission denied as file error', () => {
    const result = classifyError(new Error('Permission denied'));
    expect(result.code).toBe(ErrorCodes.FILE_PERMISSION_DENIED);
  });

  it('should classify not found as file error', () => {
    const result = classifyError(new Error('File not found'));
    expect(result.code).toBe(ErrorCodes.FILE_NOT_FOUND);
  });

  it('should classify unsupported format as file error', () => {
    const result = classifyError(new Error('Unsupported file format'));
    expect(result.code).toBe(ErrorCodes.FILE_UNSUPPORTED_FORMAT);
  });

  it('should classify corrupt/extraction as PDF error', () => {
    const result = classifyError(new Error('PDF extraction failed'));
    expect(result.code).toBe(ErrorCodes.FILE_CORRUPTED_PDF);
  });

  it('should classify SQLite errors as DB errors', () => {
    const result = classifyError(new Error('SQLite error: database is locked'));
    expect(result.code).toBe(ErrorCodes.DB_QUERY_ERROR);
  });

  it('should classify constraint violations', () => {
    const result = classifyError(new Error('UNIQUE constraint failed'));
    expect(result.code).toBe(ErrorCodes.DB_CONSTRAINT_VIOLATION);
  });

  it('should wrap generic Error with UNKNOWN_ERROR', () => {
    const result = classifyError(new Error('Something weird happened'));
    expect(result.code).toBe(ErrorCodes.UNKNOWN_ERROR);
    expect(result.message).toContain('Something weird happened');
  });

  it('should handle string errors', () => {
    const result = classifyError('a string error');
    expect(result.code).toBe(ErrorCodes.UNKNOWN_ERROR);
    expect(result.message).toContain('a string error');
  });

  it('should handle non-Error, non-string values', () => {
    const result = classifyError(42);
    expect(result.code).toBe(ErrorCodes.UNKNOWN_ERROR);
    expect(result.message).toContain('unexpected error');
  });

  it('should handle null/undefined', () => {
    const result = classifyError(null);
    expect(result.code).toBe(ErrorCodes.UNKNOWN_ERROR);
  });

  it('should prepend context prefix', () => {
    const result = classifyError(new Error('test'), 'MyModule');
    expect(result.message).toContain('[MyModule]');
    expect(result.message).toContain('test');
  });
});

// ============================================================
// shouldRetry
// ============================================================

describe('shouldRetry', () => {
  it('should return true for retryable codes', () => {
    expect(shouldRetry(createApiError(ErrorCodes.RATE_LIMITED, ''))).toBe(true);
    expect(shouldRetry(createApiError(ErrorCodes.SERVER_ERROR, ''))).toBe(true);
    expect(shouldRetry(createApiError(ErrorCodes.MALFORMED_JSON, ''))).toBe(true);
    expect(shouldRetry(createApiError(ErrorCodes.EMPTY_RESPONSE, ''))).toBe(true);
    expect(shouldRetry(createApiError(ErrorCodes.VALIDATION_ERROR, ''))).toBe(true);
    expect(shouldRetry(createApiError(ErrorCodes.NETWORK_ERROR, ''))).toBe(true);
    expect(shouldRetry(createApiError(ErrorCodes.DB_CONNECTION_LOST, ''))).toBe(true);
  });

  it('should return false for non-retryable codes', () => {
    expect(shouldRetry(createApiError(ErrorCodes.AUTH_INVALID_KEY, ''))).toBe(false);
    expect(shouldRetry(createApiError(ErrorCodes.BAD_REQUEST, ''))).toBe(false);
    expect(shouldRetry(createApiError(ErrorCodes.FILE_NOT_FOUND, ''))).toBe(false);
    expect(shouldRetry(createApiError(ErrorCodes.DB_CONSTRAINT_VIOLATION, ''))).toBe(false);
    expect(shouldRetry(createApiError(ErrorCodes.UNKNOWN_ERROR, ''))).toBe(false);
  });

  it('should retry on 429 status regardless of code', () => {
    const err = createApiError('SOME_CODE', '', 429);
    expect(shouldRetry(err)).toBe(true);
  });

  it('should retry on 5xx status regardless of code', () => {
    expect(shouldRetry(createApiError('SOME_CODE', '', 500))).toBe(true);
    expect(shouldRetry(createApiError('SOME_CODE', '', 503))).toBe(true);
    expect(shouldRetry(createApiError('SOME_CODE', '', 502))).toBe(true);
  });
});

// ============================================================
// mapApiError — user-friendly messages
// ============================================================

describe('mapApiError', () => {
  it('should return friendly message for known error codes', () => {
    const err = createApiError(ErrorCodes.AUTH_INVALID_KEY, '');
    expect(mapApiError(err)).toContain('Invalid API key');
  });

  it('should return friendly message for rate limited', () => {
    const err = createApiError(ErrorCodes.RATE_LIMITED, '');
    expect(mapApiError(err)).toContain('Rate limited');
  });

  it('should return friendly message for server error', () => {
    const err = createApiError(ErrorCodes.SERVER_ERROR, '');
    expect(mapApiError(err)).toContain('temporarily unavailable');
  });

  it('should return friendly message for network error', () => {
    const err = createApiError(ErrorCodes.NETWORK_ERROR, '');
    expect(mapApiError(err)).toContain('Network error');
  });

  it('should return friendly message for malformed JSON', () => {
    const err = createApiError(ErrorCodes.MALFORMED_JSON, '');
    expect(mapApiError(err)).toContain('unexpected response format');
  });

  it('should return friendly message for file not found', () => {
    const err = createApiError(ErrorCodes.FILE_NOT_FOUND, '');
    expect(mapApiError(err)).toContain('File not found');
  });

  it('should return friendly message for unsupported format', () => {
    const err = createApiError(ErrorCodes.FILE_UNSUPPORTED_FORMAT, '');
    expect(mapApiError(err)).toContain('Unsupported file format');
  });

  it('should return friendly message for file too large', () => {
    const err = createApiError(ErrorCodes.FILE_TOO_LARGE, '');
    expect(mapApiError(err)).toContain('too large');
  });

  it('should return friendly message for corrupted PDF', () => {
    const err = createApiError(ErrorCodes.FILE_CORRUPTED_PDF, '');
    expect(mapApiError(err)).toContain('scanned or image-only');
  });

  it('should return friendly message for DB connection lost', () => {
    const err = createApiError(ErrorCodes.DB_CONNECTION_LOST, '');
    expect(mapApiError(err)).toContain('connection lost');
  });

  it('should return friendly message for DB constraint violation', () => {
    const err = createApiError(ErrorCodes.DB_CONSTRAINT_VIOLATION, '');
    expect(mapApiError(err)).toContain('constraint');
  });

  it('should return friendly message for DB migration failure', () => {
    const err = createApiError(ErrorCodes.DB_MIGRATION_FAILURE, '');
    expect(mapApiError(err)).toContain('migration');
  });

  it('should return friendly message for test question count mismatch', () => {
    const err = createApiError(ErrorCodes.TEST_QUESTION_COUNT_MISMATCH, '');
    expect(mapApiError(err)).toContain('wrong number of questions');
  });

  it('should return friendly message for test missing fields', () => {
    const err = createApiError(ErrorCodes.TEST_MISSING_FIELDS, '');
    expect(mapApiError(err)).toContain('missing required fields');
  });

  it('should return friendly message for prompt too short', () => {
    const err = createApiError(ErrorCodes.INPUT_PROMPT_TOO_SHORT, '');
    expect(mapApiError(err)).toContain('at least 10 characters');
  });

  it('should return friendly message for prompt too long', () => {
    const err = createApiError(ErrorCodes.INPUT_PROMPT_TOO_LONG, '');
    expect(mapApiError(err)).toContain('at most 10,000');
  });

  it('should fall back to ApiError.message for unknown codes', () => {
    const err = createApiError('CUSTOM_UNKNOWN_CODE', 'My custom message');
    expect(mapApiError(err)).toBe('My custom message');
  });

  it('should fall back to Error.message for standard Error', () => {
    expect(mapApiError(new Error('Standard error'))).toBe('Standard error');
  });

  it('should handle string errors', () => {
    expect(mapApiError('String error')).toBe('String error');
  });

  it('should return generic message for null/undefined', () => {
    expect(mapApiError(null)).toContain('unexpected error');
    expect(mapApiError(undefined)).toContain('unexpected error');
  });
});

// ============================================================
// Input validation — validateApiKey
// ============================================================

describe('validateApiKey', () => {
  it('should reject empty string', () => {
    const result = validateApiKey('');
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.INPUT_API_KEY_EMPTY);
  });

  it('should reject whitespace-only string', () => {
    const result = validateApiKey('   ');
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.INPUT_API_KEY_EMPTY);
  });

  it('should reject too-short key after trimming', () => {
    const result = validateApiKey('sk');
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.INPUT_API_KEY_TOO_SHORT);
  });

  it('should accept a valid-looking key', () => {
    const result = validateApiKey('sk-or-v1-valid-key-here-12345');
    expect(result.valid).toBe(true);
  });

  it('should trim whitespace before validating', () => {
    const result = validateApiKey('  sk-or-v1-valid-key  ');
    expect(result.valid).toBe(true);
  });

  it('should accept key at minimum length', () => {
    const result = validateApiKey('12345678'); // exactly 8 chars
    expect(result.valid).toBe(true);
  });
});

// ============================================================
// Input validation — validateQuestionCount
// ============================================================

describe('validateQuestionCount', () => {
  it('should accept value 1', () => {
    expect(validateQuestionCount(1).valid).toBe(true);
  });

  it('should accept value 50', () => {
    expect(validateQuestionCount(50).valid).toBe(true);
  });

  it('should accept value 25', () => {
    expect(validateQuestionCount(25).valid).toBe(true);
  });

  it('should reject 0', () => {
    const result = validateQuestionCount(0);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.INPUT_QUESTION_COUNT_RANGE);
  });

  it('should reject 51', () => {
    const result = validateQuestionCount(51);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.INPUT_QUESTION_COUNT_RANGE);
  });

  it('should reject negative numbers', () => {
    const result = validateQuestionCount(-1);
    expect(result.valid).toBe(false);
  });

  it('should reject float values', () => {
    const result = validateQuestionCount(10.5);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.INPUT_QUESTION_COUNT_INTEGER);
  });

  it('should reject NaN', () => {
    const result = validateQuestionCount(NaN);
    expect(result.valid).toBe(false);
  });
});

// ============================================================
// Input validation — validateMcqPercentage
// ============================================================

describe('validateMcqPercentage', () => {
  it('should accept 0', () => {
    expect(validateMcqPercentage(0).valid).toBe(true);
  });

  it('should accept 100', () => {
    expect(validateMcqPercentage(100).valid).toBe(true);
  });

  it('should accept 50', () => {
    expect(validateMcqPercentage(50).valid).toBe(true);
  });

  it('should reject -1', () => {
    const result = validateMcqPercentage(-1);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.INPUT_MCQ_PERCENTAGE_RANGE);
  });

  it('should reject 101', () => {
    const result = validateMcqPercentage(101);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.INPUT_MCQ_PERCENTAGE_RANGE);
  });

  it('should reject float values', () => {
    const result = validateMcqPercentage(50.5);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.INPUT_MCQ_PERCENTAGE_INTEGER);
  });

  it('should reject NaN', () => {
    const result = validateMcqPercentage(NaN);
    expect(result.valid).toBe(false);
  });
});

// ============================================================
// Input validation — validatePrompt
// ============================================================

describe('validatePrompt', () => {
  it('should accept a valid prompt', () => {
    const result = validatePrompt('This is a valid prompt with enough characters');
    expect(result.valid).toBe(true);
  });

  it('should accept prompt at minimum length (10 chars)', () => {
    const result = validatePrompt('1234567890'); // exactly 10 chars
    expect(result.valid).toBe(true);
  });

  it('should reject prompt under 10 characters', () => {
    const result = validatePrompt('Short');
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.INPUT_PROMPT_TOO_SHORT);
  });

  it('should reject empty prompt', () => {
    const result = validatePrompt('');
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.INPUT_PROMPT_TOO_SHORT);
  });

  it('should reject whitespace-only prompt', () => {
    const result = validatePrompt('     ');
    expect(result.valid).toBe(false);
  });

  it('should reject prompt over 10000 characters', () => {
    const result = validatePrompt('x'.repeat(10001));
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.INPUT_PROMPT_TOO_LONG);
  });

  it('should accept prompt at maximum length (10000 chars)', () => {
    const result = validatePrompt('x'.repeat(10000));
    expect(result.valid).toBe(true);
  });

  it('should skip validation when file is selected', () => {
    const result = validatePrompt('', true);
    expect(result.valid).toBe(true);
  });

  it('should skip validation when file is selected even with short prompt', () => {
    const result = validatePrompt('x', true);
    expect(result.valid).toBe(true);
  });
});

// ============================================================
// Input validation — validateDifficulty
// ============================================================

describe('validateDifficulty', () => {
  it('should accept Easy', () => {
    expect(validateDifficulty('Easy').valid).toBe(true);
  });

  it('should accept Medium', () => {
    expect(validateDifficulty('Medium').valid).toBe(true);
  });

  it('should accept Hard', () => {
    expect(validateDifficulty('Hard').valid).toBe(true);
  });

  it('should reject invalid values', () => {
    const result = validateDifficulty('Impossible');
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.INPUT_DIFFICULTY_INVALID);
  });

  it('should reject empty string', () => {
    const result = validateDifficulty('');
    expect(result.valid).toBe(false);
  });

  it('should be case-sensitive', () => {
    const result = validateDifficulty('easy');
    expect(result.valid).toBe(false);
  });
});

// ============================================================
// Toggle validation — validateToggles
// ============================================================

describe('validateToggles', () => {
  it('should reject when both toggles are off', () => {
    const result = validateToggles(false, false);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.TOGGLES_BOTH_OFF);
  });

  it('should accept when only MCQ is on', () => {
    expect(validateToggles(true, false).valid).toBe(true);
  });

  it('should accept when only Text is on', () => {
    expect(validateToggles(false, true).valid).toBe(true);
  });

  it('should accept when both toggles are on', () => {
    expect(validateToggles(true, true).valid).toBe(true);
  });
});

// ============================================================
// Provider validation — validateProvider
// ============================================================

describe('validateProvider', () => {
  const baseSettings: Settings = {
    apiKey: 'sk-or-v1-test',
    model: 'test-model',
    defaultQuestionCount: 10,
    defaultMcqPercentage: 50,
    defaultDifficulty: 'Medium',
    openaiKey: 'sk-test-key',
    anthropicKey: 'sk-or-v1-test',
    geminiKey: 'AIza-test',
    ollamaUrl: 'http://localhost:11434',
    openrouterKey: 'sk-or-v1-test',
  };

  it('should accept a valid provider with matching key', () => {
    const result = validateProvider('openai', baseSettings);
    expect(result.valid).toBe(true);
  });

  it('should reject when provider key is missing', () => {
    const settings: Settings = { ...baseSettings, openaiKey: '' };
    const result = validateProvider('openai', settings);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.PROVIDER_KEY_MISSING);
  });

  it('should reject when provider key is undefined', () => {
    const settings: Settings = { ...baseSettings, openaiKey: undefined };
    const result = validateProvider('openai', settings);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.PROVIDER_KEY_MISSING);
  });

  it('should reject when provider key is whitespace only', () => {
    const settings: Settings = { ...baseSettings, openaiKey: '   ' };
    const result = validateProvider('openai', settings);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.PROVIDER_KEY_MISSING);
  });

  // ── Parametric tests for all 5 providers ──────────────────────────
  const PROVIDER_KEY_FIELDS: Record<ProviderType, keyof Settings> = {
    openai: 'openaiKey',
    anthropic: 'anthropicKey',
    gemini: 'geminiKey',
    ollama: 'ollamaUrl',
    openrouter: 'openrouterKey',
  };
  const VALID_KEY_VALUES: Record<ProviderType, string> = {
    openai: 'sk-test-key',
    anthropic: 'sk-or-v1-test',
    gemini: 'AIza-test',
    ollama: 'http://localhost:11434',
    openrouter: 'sk-or-v1-test',
  };

  for (const provider of ['openai', 'anthropic', 'gemini', 'ollama', 'openrouter'] as ProviderType[]) {
    it(`should accept valid key for ${provider}`, () => {
      const settings: Settings = { ...baseSettings };
      (settings as unknown as Record<string, string>)[PROVIDER_KEY_FIELDS[provider]] = VALID_KEY_VALUES[provider];
      const result = validateProvider(provider, settings);
      expect(result.valid).toBe(true);
    });

    it(`should reject empty key for ${provider} with PROVIDER_KEY_MISSING`, () => {
      const settings: Settings = { ...baseSettings };
      (settings as unknown as Record<string, string>)[PROVIDER_KEY_FIELDS[provider]] = '';
      const result = validateProvider(provider, settings);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCodes.PROVIDER_KEY_MISSING);
    });
  }
});

// ============================================================
// Provider key validation — validateProviderKey
// ============================================================

describe('validateProviderKey', () => {
  describe('openai', () => {
    it('should accept key starting with sk-', () => {
      expect(validateProviderKey('openai', 'sk-test-key-123').valid).toBe(true);
    });

    it('should accept key starting with sk-proj-', () => {
      expect(validateProviderKey('openai', 'sk-proj-test-key').valid).toBe(true);
    });

    it('should reject key starting with sk-ant-', () => {
      const result = validateProviderKey('openai', 'sk-ant-test-key');
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCodes.PROVIDER_INVALID);
    });

    it('should reject key starting with sk-or-', () => {
      const result = validateProviderKey('openai', 'sk-or-v1-test');
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCodes.PROVIDER_INVALID);
    });

    it('should reject key that does not start with sk-', () => {
      const result = validateProviderKey('openai', 'not-a-key');
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCodes.PROVIDER_INVALID);
    });
  });

  describe('anthropic', () => {
    it('should accept key starting with sk-or-', () => {
      expect(validateProviderKey('anthropic', 'sk-or-v1-test').valid).toBe(true);
    });

    it('should reject key not starting with sk-or-', () => {
      const result = validateProviderKey('anthropic', 'sk-ant-test');
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCodes.PROVIDER_INVALID);
    });
  });

  describe('gemini', () => {
    it('should accept key starting with AIza', () => {
      expect(validateProviderKey('gemini', 'AIza-test-key').valid).toBe(true);
    });

    it('should reject key not starting with AIza', () => {
      const result = validateProviderKey('gemini', 'sk-test-key');
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCodes.PROVIDER_INVALID);
    });
  });

  describe('ollama', () => {
    it('should accept any non-empty URL', () => {
      expect(validateProviderKey('ollama', 'http://localhost:11434').valid).toBe(true);
    });

    it('should accept any string value', () => {
      expect(validateProviderKey('ollama', 'anything').valid).toBe(true);
    });

    it('should reject empty string', () => {
      const result = validateProviderKey('ollama', '');
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCodes.PROVIDER_KEY_MISSING);
    });
  });

  describe('openrouter', () => {
    it('should accept key starting with sk-or-', () => {
      expect(validateProviderKey('openrouter', 'sk-or-v1-test').valid).toBe(true);
    });

    it('should reject key not starting with sk-or-', () => {
      const result = validateProviderKey('openrouter', 'sk-test');
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCodes.PROVIDER_INVALID);
    });
  });

  it('should reject empty string for any provider', () => {
    const providers: ProviderType[] = ['openai', 'anthropic', 'gemini', 'ollama', 'openrouter'];
    for (const p of providers) {
      const result = validateProviderKey(p, '');
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCodes.PROVIDER_KEY_MISSING);
    }
  });
});

// ============================================================
// Retry constants
// ============================================================

describe('Retry constants', () => {
  it('should have MAX_RETRIES = 3', () => {
    expect(MAX_RETRIES).toBe(3);
  });

  it('should have exponential backoff delays', () => {
    expect(BACKOFF_DELAYS).toEqual([1000, 2000, 4000]);
    // Verify exponential-like growth
    for (let i = 1; i < BACKOFF_DELAYS.length; i++) {
      expect(BACKOFF_DELAYS[i]).toBeGreaterThan(BACKOFF_DELAYS[i - 1]);
    }
  });

  it('should have enough delays for MAX_RETRIES', () => {
    expect(BACKOFF_DELAYS.length).toBeGreaterThanOrEqual(MAX_RETRIES);
  });
});

// ============================================================
// ErrorCodes — all codes should be unique
// ============================================================

describe('ErrorCodes', () => {
  it('should have unique values for all codes', () => {
    const values = Object.values(ErrorCodes);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('should include all required error codes', () => {
    expect(ErrorCodes.AUTH_INVALID_KEY).toBeDefined();
    expect(ErrorCodes.RATE_LIMITED).toBeDefined();
    expect(ErrorCodes.NETWORK_ERROR).toBeDefined();
    expect(ErrorCodes.SERVER_ERROR).toBeDefined();
    expect(ErrorCodes.VALIDATION_ERROR).toBeDefined();
    expect(ErrorCodes.MALFORMED_JSON).toBeDefined();
    expect(ErrorCodes.EMPTY_RESPONSE).toBeDefined();
    expect(ErrorCodes.FILE_NOT_FOUND).toBeDefined();
    expect(ErrorCodes.FILE_PERMISSION_DENIED).toBeDefined();
    expect(ErrorCodes.FILE_UNSUPPORTED_FORMAT).toBeDefined();
    expect(ErrorCodes.FILE_TOO_LARGE).toBeDefined();
    expect(ErrorCodes.FILE_CORRUPTED_PDF).toBeDefined();
    expect(ErrorCodes.DB_CONNECTION_LOST).toBeDefined();
    expect(ErrorCodes.DB_CONSTRAINT_VIOLATION).toBeDefined();
    expect(ErrorCodes.DB_MIGRATION_FAILURE).toBeDefined();
    expect(ErrorCodes.TOGGLES_BOTH_OFF).toBeDefined();
    expect(ErrorCodes.PROVIDER_INVALID).toBeDefined();
    expect(ErrorCodes.PROVIDER_KEY_MISSING).toBeDefined();
  });
});

// ============================================================
// mapApiError — edge cases for UI display
// ============================================================

describe('mapApiError — edge cases for UI', () => {
  it('should handle ApiError with empty message fallback', () => {
    const err = createApiError('UNKNOWN_CODE', '');
    expect(mapApiError(err)).toBe('An unexpected error occurred.');
  });

  it('should handle ApiError with only code and no recognized message', () => {
    const err = createApiError('SOME_RANDOM_CODE', 'A fallback message');
    expect(mapApiError(err)).toBe('A fallback message');
  });

  it('should handle Error with empty message', () => {
    expect(mapApiError(new Error(''))).toBe('An unexpected error occurred.');
  });
});

// ============================================================
// classifyError — context prefix
// ============================================================

describe('classifyError — context prefix', () => {
  it('should prepend context for network errors', () => {
    const result = classifyError(new Error('Failed to fetch'), 'API');
    expect(result.message).toBe('[API] Failed to fetch');
  });

  it('should prepend context for file errors', () => {
    const result = classifyError(new Error('Permission denied'), 'FileReader');
    expect(result.message).toBe('[FileReader] Permission denied');
  });

  it('should not duplicate prefix for already-classified errors', () => {
    const apiErr = createApiError('TEST', 'original');
    const result = classifyError(apiErr, 'Context');
    expect(result.message).toBe('original'); // not '[Context] original'
    expect(result).toBe(apiErr);
  });
});
