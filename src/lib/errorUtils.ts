// ============================================================
// Centralized error handling utilities for Pressey
// ============================================================

import type { ApiError, ProviderType, Settings } from './types';

// ============================================================
// Error code constants
// ============================================================

export const ErrorCodes = {
  // API / Network errors
  AUTH_INVALID_KEY: 'AUTH_INVALID_KEY',
  RATE_LIMITED: 'RATE_LIMITED',
  BAD_REQUEST: 'BAD_REQUEST',
  SERVER_ERROR: 'SERVER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  EMPTY_RESPONSE: 'EMPTY_RESPONSE',
  MALFORMED_JSON: 'MALFORMED_JSON',
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // File errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_PERMISSION_DENIED: 'FILE_PERMISSION_DENIED',
  FILE_UNSUPPORTED_FORMAT: 'FILE_UNSUPPORTED_FORMAT',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_CORRUPTED_PDF: 'FILE_CORRUPTED_PDF',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  FILE_NO_FILE_SELECTED: 'FILE_NO_FILE_SELECTED',

  // Database errors
  DB_CONNECTION_LOST: 'DB_CONNECTION_LOST',
  DB_CONSTRAINT_VIOLATION: 'DB_CONSTRAINT_VIOLATION',
  DB_MIGRATION_FAILURE: 'DB_MIGRATION_FAILURE',
  DB_QUERY_ERROR: 'DB_QUERY_ERROR',
  DB_INIT_ERROR: 'DB_INIT_ERROR',

  // Input validation errors
  INPUT_API_KEY_EMPTY: 'INPUT_API_KEY_EMPTY',
  INPUT_API_KEY_TOO_SHORT: 'INPUT_API_KEY_TOO_SHORT',
  INPUT_QUESTION_COUNT_RANGE: 'INPUT_QUESTION_COUNT_RANGE',
  INPUT_QUESTION_COUNT_INTEGER: 'INPUT_QUESTION_COUNT_INTEGER',
  INPUT_MCQ_PERCENTAGE_RANGE: 'INPUT_MCQ_PERCENTAGE_RANGE',
  INPUT_MCQ_PERCENTAGE_INTEGER: 'INPUT_MCQ_PERCENTAGE_INTEGER',
  INPUT_PROMPT_TOO_SHORT: 'INPUT_PROMPT_TOO_SHORT',
  INPUT_PROMPT_TOO_LONG: 'INPUT_PROMPT_TOO_LONG',
  INPUT_DIFFICULTY_INVALID: 'INPUT_DIFFICULTY_INVALID',

  // Test generation / validation errors
  TEST_QUESTION_COUNT_MISMATCH: 'TEST_QUESTION_COUNT_MISMATCH',
  TEST_MCQ_COUNT_MISMATCH: 'TEST_MCQ_COUNT_MISMATCH',
  TEST_MISSING_FIELDS: 'TEST_MISSING_FIELDS',
  TEST_INVALID_TYPE: 'TEST_INVALID_TYPE',
  TEST_OPTIONS_COUNT: 'TEST_OPTIONS_COUNT',
  TEST_ANSWER_NOT_IN_OPTIONS: 'TEST_ANSWER_NOT_IN_OPTIONS',
  TEST_MISSING_EXPLANATION: 'TEST_MISSING_EXPLANATION',

  // Toggle / provider validation errors
  TOGGLES_BOTH_OFF: 'TOGGLES_BOTH_OFF',
  PROVIDER_INVALID: 'PROVIDER_INVALID',
  PROVIDER_KEY_MISSING: 'PROVIDER_KEY_MISSING',

  // Generic
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ============================================================
// ApiError factory
// ============================================================

export function createApiError(
  code: string,
  message: string,
  status?: number,
  originalError?: unknown
): ApiError {
  const err: ApiError = { code, message };
  if (status !== undefined) err.status = status;
  // Attach original for debugging (not serialized in user-facing messages)
  if (originalError !== undefined) {
    (err as ApiError & { original?: unknown }).original = originalError;
  }
  return err;
}

// ============================================================
// Type guards
// ============================================================

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as { code: unknown }).code === 'string'
  );
}

// ============================================================
// Error classification — wraps any thrown value into ApiError
// ============================================================

/**
 * Inspect an unknown error value and classify it into a typed ApiError.
 * Handles: existing ApiError objects, Error instances, network errors,
 * string messages, and totally unexpected values.
 */
export function classifyError(err: unknown, context?: string): ApiError {
  // Already a typed ApiError
  if (isApiError(err)) return err;

  const prefix = context ? `[${context}] ` : '';

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();

    // Network / fetch errors
    if (
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('abort') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound')
    ) {
      return createApiError(ErrorCodes.NETWORK_ERROR, `${prefix}${err.message}`);
    }

    // File errors
    if (msg.includes('permission denied') || msg.includes('eacces')) {
      return createApiError(ErrorCodes.FILE_PERMISSION_DENIED, `${prefix}${err.message}`);
    }
    if (msg.includes('not found') || msg.includes('enoent')) {
      return createApiError(ErrorCodes.FILE_NOT_FOUND, `${prefix}${err.message}`);
    }
    if (msg.includes('unsupported') || msg.includes('format')) {
      return createApiError(ErrorCodes.FILE_UNSUPPORTED_FORMAT, `${prefix}${err.message}`);
    }
    if (msg.includes('too large') || msg.includes('exceeds')) {
      return createApiError(ErrorCodes.FILE_TOO_LARGE, `${prefix}${err.message}`);
    }
    if (msg.includes('corrupt') || msg.includes('extraction failed')) {
      return createApiError(ErrorCodes.FILE_CORRUPTED_PDF, `${prefix}${err.message}`);
    }

    // DB errors
    if (
      msg.includes('sqlite') ||
      msg.includes('database') ||
      msg.includes('constraint') ||
      msg.includes('unique')
    ) {
      if (msg.includes('constraint') || msg.includes('unique')) {
        return createApiError(ErrorCodes.DB_CONSTRAINT_VIOLATION, `${prefix}${err.message}`);
      }
      return createApiError(ErrorCodes.DB_QUERY_ERROR, `${prefix}${err.message}`);
    }

    // Generic Error → message becomes the code
    return createApiError(ErrorCodes.UNKNOWN_ERROR, `${prefix}${err.message}`);
  }

  // String errors
  if (typeof err === 'string') {
    return createApiError(ErrorCodes.UNKNOWN_ERROR, `${prefix}${err}`);
  }

  // Everything else
  return createApiError(
    ErrorCodes.UNKNOWN_ERROR,
    `${prefix}An unexpected error occurred`
  );
}

// ============================================================
// Retry policy
// ============================================================

export const MAX_RETRIES = 3;
export const BACKOFF_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s (exponential)

const RETRYABLE_CODES: Set<string> = new Set([
  ErrorCodes.RATE_LIMITED,
  ErrorCodes.SERVER_ERROR,
  ErrorCodes.MALFORMED_JSON,
  ErrorCodes.EMPTY_RESPONSE,
  ErrorCodes.VALIDATION_ERROR,
  ErrorCodes.NETWORK_ERROR,
  ErrorCodes.DB_CONNECTION_LOST,
]);

export function shouldRetry(error: ApiError): boolean {
  if (error.status === 429) return true;
  if (error.status !== undefined && error.status >= 500) return true;
  return RETRYABLE_CODES.has(error.code);
}

// ============================================================
// User-friendly error messages
// ============================================================

const USER_MESSAGES: Record<string, string> = {
  // API / Network
  [ErrorCodes.AUTH_INVALID_KEY]:
    'Invalid API key. Please check your OpenRouter API key in Settings.',
  [ErrorCodes.RATE_LIMITED]:
    'Rate limited. Please wait a moment and try again.',
  [ErrorCodes.BAD_REQUEST]:
    'Bad request. Please check the request parameters.',
  [ErrorCodes.SERVER_ERROR]:
    'The AI service is temporarily unavailable. Please try again shortly.',
  [ErrorCodes.NETWORK_ERROR]:
    'Network error. Please check your internet connection and try again.',
  [ErrorCodes.API_ERROR]:
    'The AI service returned an error. Please try again.',
  [ErrorCodes.EMPTY_RESPONSE]:
    'The AI returned an empty response. Please try again.',
  [ErrorCodes.MALFORMED_JSON]:
    'The AI returned an unexpected response format. Please try again.',
  [ErrorCodes.VALIDATION_ERROR]:
    'The AI response did not match the expected structure. Please try again.',

  // File errors
  [ErrorCodes.FILE_NOT_FOUND]:
    'File not found. Please check the file path and try again.',
  [ErrorCodes.FILE_PERMISSION_DENIED]:
    'Permission denied. Cannot read the selected file.',
  [ErrorCodes.FILE_UNSUPPORTED_FORMAT]:
    'Unsupported file format. Please select a .txt, .md, or .pdf file.',
  [ErrorCodes.FILE_TOO_LARGE]:
    'File is too large. Maximum size is 10 MB.',
  [ErrorCodes.FILE_CORRUPTED_PDF]:
    'Unable to extract text from this PDF. It may be scanned or image-only.',
  [ErrorCodes.FILE_READ_ERROR]:
    'Failed to read the file. It may be corrupted or inaccessible.',
  [ErrorCodes.FILE_NO_FILE_SELECTED]:
    'No file was selected.',

  // Database errors
  [ErrorCodes.DB_CONNECTION_LOST]:
    'Database connection lost. Please restart the application.',
  [ErrorCodes.DB_CONSTRAINT_VIOLATION]:
    'A database constraint was violated. The data may be invalid.',
  [ErrorCodes.DB_MIGRATION_FAILURE]:
    'Database migration failed. Your local data may need to be rebuilt.',
  [ErrorCodes.DB_QUERY_ERROR]:
    'A database error occurred. Please try again.',
  [ErrorCodes.DB_INIT_ERROR]:
    'Failed to initialize the database. Please restart the application.',

  // Input validation errors
  [ErrorCodes.INPUT_API_KEY_EMPTY]:
    'API key is required. Add your OpenRouter API key in Settings.',
  [ErrorCodes.INPUT_API_KEY_TOO_SHORT]:
    'API key appears too short. Please enter a valid OpenRouter API key.',
  [ErrorCodes.INPUT_QUESTION_COUNT_RANGE]:
    'Question count must be between 1 and 50.',
  [ErrorCodes.INPUT_QUESTION_COUNT_INTEGER]:
    'Question count must be a whole number.',
  [ErrorCodes.INPUT_MCQ_PERCENTAGE_RANGE]:
    'MCQ percentage must be between 0 and 100.',
  [ErrorCodes.INPUT_MCQ_PERCENTAGE_INTEGER]:
    'MCQ percentage must be a whole number.',
  [ErrorCodes.INPUT_PROMPT_TOO_SHORT]:
    'Prompt must be at least 10 characters.',
  [ErrorCodes.INPUT_PROMPT_TOO_LONG]:
    'Prompt must be at most 10,000 characters.',
  [ErrorCodes.INPUT_DIFFICULTY_INVALID]:
    'Invalid difficulty level. Must be Easy, Medium, or Hard.',

  // Toggle / provider validation errors
  [ErrorCodes.TOGGLES_BOTH_OFF]:
    'At least one question type (MCQ or Text) must be selected.',
  [ErrorCodes.PROVIDER_INVALID]:
    'Invalid provider selected. Please check your Settings.',
  [ErrorCodes.PROVIDER_KEY_MISSING]:
    'API key is missing for the selected provider. Please add it in Settings.',

  // Test generation / validation errors
  [ErrorCodes.TEST_QUESTION_COUNT_MISMATCH]:
    'The AI generated the wrong number of questions. Please try again.',
  [ErrorCodes.TEST_MCQ_COUNT_MISMATCH]:
    'The AI generated the wrong number of MCQ questions. Please try again.',
  [ErrorCodes.TEST_MISSING_FIELDS]:
    'A generated question is missing required fields. Please try again.',
  [ErrorCodes.TEST_INVALID_TYPE]:
    'A generated question has an invalid type. Please try again.',
  [ErrorCodes.TEST_OPTIONS_COUNT]:
    'An MCQ question has the wrong number of options (expected 4). Please try again.',
  [ErrorCodes.TEST_ANSWER_NOT_IN_OPTIONS]:
    'An MCQ answer does not match any of the provided options. Please try again.',
  [ErrorCodes.TEST_MISSING_EXPLANATION]:
    'A generated question is missing an explanation. Please try again.',
};

/**
 * Map a thrown error (or ApiError) to a user-friendly display string.
 * Falls back to error.message, Error.message, or a generic message.
 */
export function mapApiError(err: unknown): string {
  // ApiError with a known code → lookup friendly message
  if (isApiError(err)) {
    const friendly = USER_MESSAGES[err.code];
    if (friendly) return friendly;
    // Unknown code but still an ApiError — use its message
    return err.message || 'An unexpected error occurred.';
  }

  // Standard Error → use message if non-empty
  if (err instanceof Error && err.message) {
    return err.message;
  }

  // String thrown directly
  if (typeof err === 'string' && err.length > 0) {
    return err;
  }

  return 'An unexpected error occurred.';
}

// ============================================================
// Input validation
// ============================================================

const MIN_PROMPT_LENGTH = 10;
const MAX_PROMPT_LENGTH = 10000;
const MIN_API_KEY_LENGTH = 8; // "sk-or-v1-" prefix = 8 chars minimum

export interface ValidationResult {
  valid: boolean;
  error?: ApiError;
}

/**
 * Validate an API key: must be non-empty after trimming and meet minimum length.
 */
export function validateApiKey(apiKey: string): ValidationResult {
  const trimmed = apiKey.trim();
  if (trimmed.length === 0) {
    return {
      valid: false,
      error: createApiError(
        ErrorCodes.INPUT_API_KEY_EMPTY,
        USER_MESSAGES[ErrorCodes.INPUT_API_KEY_EMPTY]
      ),
    };
  }
  if (trimmed.length < MIN_API_KEY_LENGTH) {
    return {
      valid: false,
      error: createApiError(
        ErrorCodes.INPUT_API_KEY_TOO_SHORT,
        USER_MESSAGES[ErrorCodes.INPUT_API_KEY_TOO_SHORT]
      ),
    };
  }
  return { valid: true };
}

/**
 * Validate question count: must be an integer between 1 and 50.
 */
export function validateQuestionCount(value: number): ValidationResult {
  if (!Number.isInteger(value)) {
    return {
      valid: false,
      error: createApiError(
        ErrorCodes.INPUT_QUESTION_COUNT_INTEGER,
        USER_MESSAGES[ErrorCodes.INPUT_QUESTION_COUNT_INTEGER]
      ),
    };
  }
  if (value < 1 || value > 50) {
    return {
      valid: false,
      error: createApiError(
        ErrorCodes.INPUT_QUESTION_COUNT_RANGE,
        USER_MESSAGES[ErrorCodes.INPUT_QUESTION_COUNT_RANGE]
      ),
    };
  }
  return { valid: true };
}

/**
 * Validate MCQ percentage: must be an integer between 0 and 100.
 */
export function validateMcqPercentage(value: number): ValidationResult {
  if (!Number.isInteger(value)) {
    return {
      valid: false,
      error: createApiError(
        ErrorCodes.INPUT_MCQ_PERCENTAGE_INTEGER,
        USER_MESSAGES[ErrorCodes.INPUT_MCQ_PERCENTAGE_INTEGER]
      ),
    };
  }
  if (value < 0 || value > 100) {
    return {
      valid: false,
      error: createApiError(
        ErrorCodes.INPUT_MCQ_PERCENTAGE_RANGE,
        USER_MESSAGES[ErrorCodes.INPUT_MCQ_PERCENTAGE_RANGE]
      ),
    };
  }
  return { valid: true };
}

/**
 * Validate prompt text: must be 10-10000 characters.
 * If a file is selected, prompt validation is skipped (returns valid).
 */
export function validatePrompt(prompt: string, fileSelected: boolean = false): ValidationResult {
  if (fileSelected) return { valid: true };

  const trimmed = prompt.trim();
  if (trimmed.length < MIN_PROMPT_LENGTH) {
    return {
      valid: false,
      error: createApiError(
        ErrorCodes.INPUT_PROMPT_TOO_SHORT,
        USER_MESSAGES[ErrorCodes.INPUT_PROMPT_TOO_SHORT]
      ),
    };
  }
  if (trimmed.length > MAX_PROMPT_LENGTH) {
    return {
      valid: false,
      error: createApiError(
        ErrorCodes.INPUT_PROMPT_TOO_LONG,
        USER_MESSAGES[ErrorCodes.INPUT_PROMPT_TOO_LONG]
      ),
    };
  }
  return { valid: true };
}

/**
 * Validate difficulty: must be one of Easy, Medium, Hard.
 */
export function validateDifficulty(
  value: string
): ValidationResult {
  const validDifficulties = ['Easy', 'Medium', 'Hard'];
  if (!validDifficulties.includes(value)) {
    return {
      valid: false,
      error: createApiError(
        ErrorCodes.INPUT_DIFFICULTY_INVALID,
        USER_MESSAGES[ErrorCodes.INPUT_DIFFICULTY_INVALID]
      ),
    };
  }
  return { valid: true };
}

// ============================================================
// Toggle / provider validation
// ============================================================

/**
 * Validate that at least one question type toggle is enabled.
 */
export function validateToggles(
  includeMcq: boolean,
  includeText: boolean
): ValidationResult {
  if (!includeMcq && !includeText) {
    return {
      valid: false,
      error: createApiError(
        ErrorCodes.TOGGLES_BOTH_OFF,
        USER_MESSAGES[ErrorCodes.TOGGLES_BOTH_OFF]
      ),
    };
  }
  return { valid: true };
}

const VALID_PROVIDERS: ProviderType[] = [
  'openai',
  'anthropic',
  'gemini',
  'ollama',
  'openrouter',
];

/**
 * Validate that the provider is a known provider type and that
 * the corresponding API key / URL is present in settings.
 */
export function validateProvider(
  provider: ProviderType,
  settings: Settings
): ValidationResult {
  if (!VALID_PROVIDERS.includes(provider)) {
    return {
      valid: false,
      error: createApiError(
        ErrorCodes.PROVIDER_INVALID,
        USER_MESSAGES[ErrorCodes.PROVIDER_INVALID]
      ),
    };
  }
  // Check that the required key/URL for this provider exists and is non-empty
  const keyMap: Record<ProviderType, string | undefined> = {
    openai: settings.openaiKey,
    anthropic: settings.anthropicKey,
    gemini: settings.geminiKey,
    ollama: settings.ollamaUrl,
    openrouter: settings.openrouterKey,
  };
  const key = keyMap[provider];
  if (!key || key.trim().length === 0) {
    return {
      valid: false,
      error: createApiError(
        ErrorCodes.PROVIDER_KEY_MISSING,
        USER_MESSAGES[ErrorCodes.PROVIDER_KEY_MISSING]
      ),
    };
  }
  return { valid: true };
}

/**
 * Validate that a provider's key matches the expected prefix pattern.
 *
 * - openai:     must start with `sk-` (but not `sk-ant-` or `sk-or-`)
 * - anthropic:  must start with `sk-or-` (OpenRouter routing)
 * - gemini:     must start with `AIza`
 * - ollama:     any non-empty value (URL)
 * - openrouter: must start with `sk-or-`
 */
export function validateProviderKey(
  provider: ProviderType,
  key: string
): ValidationResult {
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    return {
      valid: false,
      error: createApiError(
        ErrorCodes.PROVIDER_KEY_MISSING,
        USER_MESSAGES[ErrorCodes.PROVIDER_KEY_MISSING]
      ),
    };
  }

  switch (provider) {
    case 'openai': {
      if (
        trimmed.startsWith('sk-') &&
        !trimmed.startsWith('sk-ant-') &&
        !trimmed.startsWith('sk-or-')
      ) {
        return { valid: true };
      }
      return {
        valid: false,
        error: createApiError(
          ErrorCodes.PROVIDER_INVALID,
          `Invalid OpenAI API key format. Expected a key starting with "sk-" (not an Anthropic or OpenRouter key).`
        ),
      };
    }
    case 'anthropic': {
      if (trimmed.startsWith('sk-or-')) {
        return { valid: true };
      }
      return {
        valid: false,
        error: createApiError(
          ErrorCodes.PROVIDER_INVALID,
          'Invalid Anthropic key format. Anthropic uses OpenRouter routing, so the key must start with "sk-or-".'
        ),
      };
    }
    case 'gemini': {
      if (trimmed.startsWith('AIza')) {
        return { valid: true };
      }
      return {
        valid: false,
        error: createApiError(
          ErrorCodes.PROVIDER_INVALID,
          'Invalid Gemini API key format. Expected a key starting with "AIza".'
        ),
      };
    }
    case 'ollama': {
      // Any non-empty value is accepted (URL)
      return { valid: true };
    }
    case 'openrouter': {
      if (trimmed.startsWith('sk-or-')) {
        return { valid: true };
      }
      return {
        valid: false,
        error: createApiError(
          ErrorCodes.PROVIDER_INVALID,
          'Invalid OpenRouter API key format. Expected a key starting with "sk-or-".'
        ),
      };
    }
    default: {
      return {
        valid: false,
        error: createApiError(
          ErrorCodes.PROVIDER_INVALID,
          `Unknown provider: "${provider}".`
        ),
      };
    }
  }
}
