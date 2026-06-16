import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateWithProvider } from './client';
import { ErrorCodes } from '../errorUtils';
import type { Settings, TestConfig } from '../types';

// Mock sleep so retry tests don't actually wait
vi.mock('../utils', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
  cn: vi.fn((...inputs: string[]) => inputs.join(' ')),
}));

// ============================================================
// Test data
// ============================================================

const DEFAULT_CONFIG: TestConfig = {
  questionCount: 5,
  mcqPercentage: 60,
  difficulty: 'Medium',
  topic: 'JavaScript',
};

const PROVIDER_SETTINGS: Settings = {
  apiKey: 'sk-legacy',
  model: 'gpt-4o-mini-custom',
  defaultQuestionCount: 5,
  defaultMcqPercentage: 60,
  defaultDifficulty: 'Medium',
  openaiKey: 'sk-openai-123',
  openrouterKey: 'sk-or-v1-abc',
  anthropicKey: 'sk-anthropic-ignored', // Anthropic routes via OpenRouter → uses openrouterKey
  geminiKey: 'sk-gemini-789',
  ollamaUrl: 'http://localhost:11434',
};

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...PROVIDER_SETTINGS, ...overrides };
}

function createValidResponse(overrides?: Record<string, unknown>) {
  return {
    id: 'chatcmpl-test-123',
    choices: [
      {
        message: {
          content: JSON.stringify(
            overrides || {
              title: 'JavaScript Fundamentals Test',
              topic: 'JavaScript',
              questions: [
                {
                  type: 'mcq',
                  text: 'What is a closure in JavaScript?',
                  options: ['A feature', 'A bug', 'A function with lexical scope', 'A variable'],
                  correctAnswer: 'A function with lexical scope',
                  explanation: 'Closures capture variables from outer scope.',
                },
                {
                  type: 'mcq',
                  text: 'What does `typeof null` return?',
                  options: ['null', 'undefined', 'object', 'boolean'],
                  correctAnswer: 'object',
                  explanation: 'A known JavaScript quirk.',
                },
                {
                  type: 'mcq',
                  text: 'What is 0.1 + 0.2 === 0.3?',
                  options: ['true', 'false', 'undefined', 'NaN'],
                  correctAnswer: 'false',
                  explanation: 'Floating point precision.',
                },
                {
                  type: 'text',
                  text: 'Explain event delegation.',
                  correctAnswer: 'Single listener on a parent element.',
                  explanation: 'Uses bubbling.',
                },
                {
                  type: 'text',
                  text: 'Difference between let and var?',
                  correctAnswer: 'let is block-scoped, var is function-scoped.',
                  explanation: 'let also prevents hoisting issues.',
                },
              ],
            }
          ),
        },
        finish_reason: 'stop',
      },
    ],
  };
}

function okResponse() {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(createValidResponse()),
  };
}

function errorResponse(status: number, body: unknown = {}) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(body),
  };
}

// ============================================================
// Tests
// ============================================================

describe('generateWithProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------- OpenAI provider --------

  describe('OpenAI provider', () => {
    it('should call OpenAI URL with Bearer auth and build correct request', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      const test = await generateWithProvider(
        'openai',
        'Create a JavaScript test',
        DEFAULT_CONFIG,
        makeSettings(),
      );

      // URL
      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://api.openai.com/v1/chat/completions',
      );

      // Headers
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer sk-openai-123');
      expect(headers['Content-Type']).toBe('application/json');
      // OpenAI has no extra provider-specific headers
      expect(headers['HTTP-Referer']).toBeUndefined();
      expect(headers['X-Title']).toBeUndefined();

      // Body
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('gpt-4o-mini-custom'); // settings.model takes priority
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toContain('expert tutor');
      expect(body.messages[0].content).toContain('JavaScript');
      expect(body.messages[0].content).toContain('5');
      expect(body.messages[0].content).toContain('Medium');
      expect(body.messages[1].role).toBe('user');
      expect(body.messages[1].content).toBe('Create a JavaScript test');
      expect(body.response_format).toEqual({ type: 'json_object' });
      expect(body.temperature).toBe(0.7);

      // Returned Test
      expect(test.title).toBe('JavaScript Fundamentals Test');
      expect(test.topic).toBe('JavaScript');
      expect(test.difficulty).toBe('Medium');
      expect(test.questionCount).toBe(5);
      expect(test.mcqPercentage).toBe(60);
      expect(test.questions).toHaveLength(5);
      const mcqs = test.questions.filter((q) => q.type === 'mcq');
      expect(mcqs).toHaveLength(3);
      for (const q of mcqs) {
        expect(q.options).toHaveLength(4);
        expect(q.orderIndex).toBeGreaterThanOrEqual(0);
      }
    });

    it('should fall back to provider default model when settings.model is empty', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      const settings = makeSettings({ model: '' });
      await generateWithProvider('openai', 'prompt', DEFAULT_CONFIG, settings);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('gpt-4o');
    });
  });

  // -------- Anthropic provider --------

  describe('Anthropic provider', () => {
    it('should route through OpenRouter URL with openrouterKey and provider-specific headers', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      await generateWithProvider(
        'anthropic',
        'Create a Python test',
        DEFAULT_CONFIG,
        makeSettings(),
      );

      // URL — Anthropic routes via OpenRouter
      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://openrouter.ai/api/v1/chat/completions',
      );

      // Headers — uses openrouterKey (NOT anthropicKey)
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer sk-or-v1-abc');
      expect(headers['Content-Type']).toBe('application/json');
      // Provider-specific headers from registry
      expect(headers['HTTP-Referer']).toBe('https://pressey.app');
      expect(headers['X-Title']).toBe('Pressey AI Test Generator');

      // Body — Anthropic default model is anthropic/claude-3.5-sonnet
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('gpt-4o-mini-custom'); // settings.model takes priority
    });

    it('should use Anthropic default model when settings.model is empty', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      const settings = makeSettings({ model: '' });
      await generateWithProvider('anthropic', 'prompt', DEFAULT_CONFIG, settings);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('anthropic/claude-3.5-sonnet');
    });
  });

  // -------- Gemini provider --------

  describe('Gemini provider', () => {
    it('should call Gemini OpenAI-compat endpoint with geminiKey', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      await generateWithProvider(
        'gemini',
        'Create a TS test',
        DEFAULT_CONFIG,
        makeSettings(),
      );

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      );

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer sk-gemini-789');
      expect(headers['Content-Type']).toBe('application/json');
      // Gemini has no extra provider-specific headers
      expect(headers['HTTP-Referer']).toBeUndefined();
      expect(headers['X-Title']).toBeUndefined();

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('gpt-4o-mini-custom');
    });

    it('should use Gemini default model when settings.model is empty', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      const settings = makeSettings({ model: '' });
      await generateWithProvider('gemini', 'prompt', DEFAULT_CONFIG, settings);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('gemini-1.5-pro');
    });
  });

  // -------- Ollama provider --------

  describe('Ollama provider', () => {
    it('should use ollamaUrl as base, send NO Authorization header, and use Ollama default model', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      await generateWithProvider(
        'ollama',
        'Create a Rust test',
        DEFAULT_CONFIG,
        makeSettings(),
      );

      // URL — built from settings.ollamaUrl
      expect(mockFetch.mock.calls[0][0]).toBe(
        'http://localhost:11434/v1/chat/completions',
      );

      // Headers — NO Authorization
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBeUndefined();
      expect(headers['Content-Type']).toBe('application/json');
      // Ollama has no extra provider-specific headers
      expect(headers['HTTP-Referer']).toBeUndefined();

      // Body
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('gpt-4o-mini-custom');
    });

    it('should use Ollama default model (llama3.2) when settings.model is empty', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      const settings = makeSettings({ model: '' });
      await generateWithProvider('ollama', 'prompt', DEFAULT_CONFIG, settings);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('llama3.2');
    });

    it('should respect a custom ollamaUrl in settings (e.g. non-default port)', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      const settings = makeSettings({ ollamaUrl: 'http://192.168.1.50:9999' });
      await generateWithProvider('ollama', 'prompt', DEFAULT_CONFIG, settings);

      expect(mockFetch.mock.calls[0][0]).toBe(
        'http://192.168.1.50:9999/v1/chat/completions',
      );
      // No Authorization header
      expect(mockFetch.mock.calls[0][1].headers['Authorization']).toBeUndefined();
    });
  });

  // -------- OpenRouter provider --------

  describe('OpenRouter provider', () => {
    it('should call OpenRouter URL with openrouterKey and provider-specific headers', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      await generateWithProvider(
        'openrouter',
        'Create a Go test',
        DEFAULT_CONFIG,
        makeSettings(),
      );

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://openrouter.ai/api/v1/chat/completions',
      );

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer sk-or-v1-abc');
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['HTTP-Referer']).toBe('https://pressey.app');
      expect(headers['X-Title']).toBe('Pressey AI Test Generator');
    });
  });

  // -------- Per-provider Authorization header verification (T4 regression) --------

  describe('Authorization header per provider (T4 regression)', () => {
    it('openai: openaiKey is sent as Bearer', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      const settings = makeSettings({
        openaiKey: 'sk-test123',
        anthropicKey: 'sk-anthropic-wrong',
        geminiKey: 'sk-gemini-wrong',
        openrouterKey: 'sk-or-wrong',
      });

      await generateWithProvider('openai', 'p', DEFAULT_CONFIG, settings);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer sk-test123');
    });

    it('anthropic: openrouterKey is sent as Bearer (NOT anthropicKey)', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      const settings = makeSettings({
        anthropicKey: 'sk-anthropic-NEVER-USED',
        openrouterKey: 'sk-or-test',
        openaiKey: 'sk-openai-wrong',
        geminiKey: 'sk-gemini-wrong',
      });

      await generateWithProvider('anthropic', 'p', DEFAULT_CONFIG, settings);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer sk-or-test');
      expect(headers['Authorization']).not.toContain('sk-anthropic');
    });

    it('gemini: geminiKey is sent as Bearer', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      const settings = makeSettings({
        geminiKey: 'sk-gemini-test',
        openaiKey: 'sk-openai-wrong',
        openrouterKey: 'sk-or-wrong',
      });

      await generateWithProvider('gemini', 'p', DEFAULT_CONFIG, settings);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer sk-gemini-test');
    });

    it('ollama: NO Authorization header (local server, no auth)', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      const settings = makeSettings({
        ollamaUrl: 'http://localhost:11434',
        openaiKey: 'sk-should-not-appear',
        openrouterKey: 'sk-or-should-not-appear',
      });

      await generateWithProvider('ollama', 'p', DEFAULT_CONFIG, settings);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBeUndefined();
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('openrouter: openrouterKey is sent as Bearer with HTTP-Referer/X-Title', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      const settings = makeSettings({
        openrouterKey: 'sk-or-final',
        openaiKey: 'sk-openai-wrong',
        anthropicKey: 'sk-anthropic-wrong',
        geminiKey: 'sk-gemini-wrong',
      });

      await generateWithProvider('openrouter', 'p', DEFAULT_CONFIG, settings);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer sk-or-final');
      expect(headers['HTTP-Referer']).toBe('https://pressey.app');
      expect(headers['X-Title']).toBe('Pressey AI Test Generator');
    });

    it('uses per-provider key even when legacy apiKey is also set to a different value', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      const settings = makeSettings({
        apiKey: 'sk-legacy-WRONG',
        openaiKey: 'sk-per-provider-RIGHT',
      });

      await generateWithProvider('openai', 'p', DEFAULT_CONFIG, settings);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer sk-per-provider-RIGHT');
      expect(headers['Authorization']).not.toContain('sk-legacy');
    });
  });

  // -------- systemPrefix placement --------

  describe('system prefix handling', () => {
    it('should prepend systemPrefix to system message content', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      await generateWithProvider(
        'openai',
        'prompt',
        DEFAULT_CONFIG,
        makeSettings(),
        'You are a pirate.',
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[0].content).toMatch(/^You are a pirate\./);
      expect(body.messages[0].content).toContain('JavaScript');
    });
  });

  // -------- Error handling: 401 --------

  describe('401 unauthorized', () => {
    it('should throw AUTH_INVALID_KEY without retrying', async () => {
      const mockFetch = vi.fn().mockResolvedValue(errorResponse(401));
      vi.stubGlobal('fetch', mockFetch);

      await expect(
        generateWithProvider('openai', 'p', DEFAULT_CONFIG, makeSettings()),
      ).rejects.toMatchObject({
        code: ErrorCodes.AUTH_INVALID_KEY,
        status: 401,
      });

      // No retry on 401
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // -------- Error handling: 400 --------

  describe('400 bad request', () => {
    it('should throw BAD_REQUEST without retrying', async () => {
      const mockFetch = vi.fn().mockResolvedValue(errorResponse(400));
      vi.stubGlobal('fetch', mockFetch);

      await expect(
        generateWithProvider('openai', 'p', DEFAULT_CONFIG, makeSettings()),
      ).rejects.toMatchObject({
        code: ErrorCodes.BAD_REQUEST,
        status: 400,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // -------- Error handling: 429 (retry) --------

  describe('429 rate limit', () => {
    it('should retry up to MAX_RETRIES+1 (4) total attempts then throw RATE_LIMITED', async () => {
      const mockFetch = vi.fn().mockResolvedValue(errorResponse(429));
      vi.stubGlobal('fetch', mockFetch);

      await expect(
        generateWithProvider('openai', 'p', DEFAULT_CONFIG, makeSettings()),
      ).rejects.toMatchObject({
        code: ErrorCodes.RATE_LIMITED,
        status: 429,
      });

      // MAX_RETRIES=3, so 1 initial + 3 retries = 4 total
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should succeed if a retry returns 200', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(errorResponse(429))
        .mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      const test = await generateWithProvider(
        'openai',
        'p',
        DEFAULT_CONFIG,
        makeSettings(),
      );
      expect(test.questions).toHaveLength(5);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // -------- Error handling: 5xx (retry) --------

  describe('500 server error', () => {
    it('should retry on 500 then throw SERVER_ERROR', async () => {
      const mockFetch = vi.fn().mockResolvedValue(errorResponse(500));
      vi.stubGlobal('fetch', mockFetch);

      await expect(
        generateWithProvider('openai', 'p', DEFAULT_CONFIG, makeSettings()),
      ).rejects.toMatchObject({
        code: ErrorCodes.SERVER_ERROR,
        status: 500,
      });

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should retry on 503 then throw SERVER_ERROR', async () => {
      const mockFetch = vi.fn().mockResolvedValue(errorResponse(503));
      vi.stubGlobal('fetch', mockFetch);

      await expect(
        generateWithProvider('openai', 'p', DEFAULT_CONFIG, makeSettings()),
      ).rejects.toMatchObject({
        code: ErrorCodes.SERVER_ERROR,
        status: 503,
      });

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  // -------- Error handling: network failure --------

  describe('network error', () => {
    it('should wrap network errors and retry, then throw NETWORK_ERROR', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
      vi.stubGlobal('fetch', mockFetch);

      await expect(
        generateWithProvider('openai', 'p', DEFAULT_CONFIG, makeSettings()),
      ).rejects.toMatchObject({
        code: ErrorCodes.NETWORK_ERROR,
        message: 'Failed to fetch',
      });

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  // -------- Error handling: malformed JSON --------

  describe('malformed JSON in response content', () => {
    it('should retry on malformed JSON, then throw MALFORMED_JSON', async () => {
      const bad = {
        id: 'chatcmpl-test',
        choices: [
          { message: { content: 'not valid json {{{' }, finish_reason: 'stop' },
        ],
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(bad),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(
        generateWithProvider('openai', 'p', DEFAULT_CONFIG, makeSettings()),
      ).rejects.toMatchObject({
        code: ErrorCodes.MALFORMED_JSON,
      });

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should recover if a retry returns valid JSON', async () => {
      const bad = {
        id: 'chatcmpl-test',
        choices: [
          { message: { content: 'not valid json {{{' }, finish_reason: 'stop' },
        ],
      };
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(bad) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(bad) })
        .mockResolvedValueOnce(okResponse());
      vi.stubGlobal('fetch', mockFetch);

      const test = await generateWithProvider(
        'openai',
        'p',
        DEFAULT_CONFIG,
        makeSettings(),
      );
      expect(test.questions).toHaveLength(5);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  // -------- Validation error --------

  describe('Zod validation error', () => {
    it('should throw VALIDATION_ERROR when response is missing required fields, after retries', async () => {
      const invalid = {
        id: 'chatcmpl-test',
        choices: [
          { message: { content: JSON.stringify({ title: 'Bad Test' }) }, finish_reason: 'stop' },
        ],
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(invalid),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(
        generateWithProvider('openai', 'p', DEFAULT_CONFIG, makeSettings()),
      ).rejects.toMatchObject({
        code: ErrorCodes.VALIDATION_ERROR,
      });

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  // -------- API-level error in response body --------

  describe('API-level error in body', () => {
    it('should throw API_ERROR for inline error message', async () => {
      const errorBody = {
        id: 'chatcmpl-test',
        choices: [],
        error: { message: 'Model overloaded', code: 503 },
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(errorBody),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(
        generateWithProvider('openai', 'p', DEFAULT_CONFIG, makeSettings()),
      ).rejects.toMatchObject({
        code: ErrorCodes.API_ERROR,
        message: expect.stringContaining('Model overloaded'),
      });
    });
  });

  // -------- Empty response --------

  describe('empty response content', () => {
    it('should retry on empty content, then throw EMPTY_RESPONSE', async () => {
      const empty = {
        id: 'chatcmpl-test',
        choices: [{ message: { content: '' }, finish_reason: 'stop' }],
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(empty),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(
        generateWithProvider('openai', 'p', DEFAULT_CONFIG, makeSettings()),
      ).rejects.toMatchObject({
        code: ErrorCodes.EMPTY_RESPONSE,
      });

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });
});
