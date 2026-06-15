import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateTest } from './api';
import type { TestConfig } from './types';

vi.mock('./utils', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
  cn: vi.fn((...inputs: string[]) => inputs.join(' ')),
}));

// ============================================================
// Test data
// ============================================================

const TEST_API_KEY = 'sk-or-v1-test-key-12345';

const DEFAULT_CONFIG: TestConfig = {
  questionCount: 5,
  mcqPercentage: 60,
  difficulty: 'Medium',
  topic: 'JavaScript',
};

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
                  explanation: 'This is a known JavaScript quirk.',
                },
                {
                  type: 'mcq',
                  text: 'What is the result of 0.1 + 0.2 === 0.3?',
                  options: ['true', 'false', 'undefined', 'NaN'],
                  correctAnswer: 'false',
                  explanation: 'Floating point precision causes this.',
                },
                {
                  type: 'text',
                  text: 'Explain event delegation in JavaScript.',
                  correctAnswer: 'Event delegation uses a single listener on a parent element.',
                  explanation: 'Uses event bubbling.',
                },
                {
                  type: 'text',
                  text: 'What is the difference between `let` and `var`?',
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

// ============================================================
// Tests
// ============================================================

describe('generateTest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Success case ---

  it('should successfully generate a test with valid response', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createValidResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    const test = await generateTest('Create a test', DEFAULT_CONFIG, TEST_API_KEY);

    expect(test.title).toBe('JavaScript Fundamentals Test');
    expect(test.topic).toBe('JavaScript');
    expect(test.difficulty).toBe('Medium');
    expect(test.questionCount).toBe(5);
    expect(test.mcqPercentage).toBe(60);
    expect(test.questions).toHaveLength(5);

    const mcqQuestions = test.questions.filter((q) => q.type === 'mcq');
    expect(mcqQuestions).toHaveLength(3);
    for (const q of mcqQuestions) {
      expect(q.options).toBeDefined();
      expect(q.options).toHaveLength(4);
      expect(q.orderIndex).toBeGreaterThanOrEqual(0);
    }

    const textQuestions = test.questions.filter((q) => q.type === 'text');
    expect(textQuestions).toHaveLength(2);
  });

  // --- 401 Invalid API key ---

  it('should return typed error for invalid API key (401)', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      generateTest('Create a test', DEFAULT_CONFIG, TEST_API_KEY)
    ).rejects.toMatchObject({
      code: 'AUTH_INVALID_KEY',
      status: 401,
      message: expect.stringContaining('Invalid API key'),
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // --- 429 Rate limit ---

  it('should retry on 429 and eventually return error after max retries', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          status: 429,
          json: () => Promise.resolve({}),
        })
    );

    await expect(
      generateTest('Create a test', DEFAULT_CONFIG, TEST_API_KEY)
    ).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  });

  // --- Malformed JSON ---

  it('should retry on malformed JSON response', async () => {
    const badResponse = {
      id: 'chatcmpl-test',
      choices: [{ message: { content: 'not valid json {{{' }, finish_reason: 'stop' }],
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(badResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(badResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(createValidResponse()) });
    vi.stubGlobal('fetch', mockFetch);

    const test = await generateTest('Create a test', DEFAULT_CONFIG, TEST_API_KEY);
    expect(test.questions).toHaveLength(5);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  // --- Network error ---

  it('should return typed error for network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));

    await expect(
      generateTest('Create a test', DEFAULT_CONFIG, TEST_API_KEY)
    ).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'Failed to fetch',
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  });

  // --- Retry logic: successful on 3rd attempt ---

  it('should succeed on 3rd attempt after failures', async () => {
    const serverError = { ok: false, status: 503, json: () => Promise.resolve({}) };
    const emptyResponse = {
      id: 'chatcmpl-test',
      choices: [{ message: { content: '' }, finish_reason: 'stop' }],
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(serverError)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(createValidResponse()) });
    vi.stubGlobal('fetch', mockFetch);

    const test = await generateTest('Create a test', DEFAULT_CONFIG, TEST_API_KEY);
    expect(test.questions).toHaveLength(5);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  // --- Prompt construction verification ---

  it('should construct prompt with topic, difficulty, question count, and MCQ percentage', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createValidResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    const config: TestConfig = {
      questionCount: 10,
      mcqPercentage: 70,
      difficulty: 'Hard',
      topic: 'React Hooks',
    };

    await generateTest('Focus on useEffect and useState', config, TEST_API_KEY);

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);

    expect(mockFetch.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`);
    expect(mockFetch.mock.calls[0][1].headers['Content-Type']).toBe('application/json');

    expect(requestBody.model).toBe('openai/gpt-4o');
    expect(requestBody.response_format).toEqual({ type: 'json_object' });
    expect(requestBody.temperature).toBe(0.7);

    const systemMessage = requestBody.messages[0];
    expect(systemMessage.role).toBe('system');
    expect(systemMessage.content).toContain('10');
    expect(systemMessage.content).toContain('React Hooks');
    expect(systemMessage.content).toContain('Hard');
    expect(systemMessage.content).toContain('7');
    expect(systemMessage.content).toContain('70%');

    const userMessage = requestBody.messages[1];
    expect(userMessage.role).toBe('user');
    expect(userMessage.content).toBe('Focus on useEffect and useState');
  });

  // --- Empty response from API ---

  it('should retry on empty response content', async () => {
    const emptyResponse = {
      id: 'chatcmpl-test',
      choices: [{ message: { content: '' }, finish_reason: 'stop' }],
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(createValidResponse()) });
    vi.stubGlobal('fetch', mockFetch);

    const test = await generateTest('Create a test', DEFAULT_CONFIG, TEST_API_KEY);
    expect(test.questions).toHaveLength(5);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // --- Validation error on invalid structure ---

  it('should fail with validation error when response is missing required fields', async () => {
    const invalidResponse = {
      id: 'chatcmpl-test',
      choices: [
        {
          message: { content: JSON.stringify({ title: 'Bad Test' }) },
          finish_reason: 'stop',
        },
      ],
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(invalidResponse) })
    );

    await expect(
      generateTest('Create a test', DEFAULT_CONFIG, TEST_API_KEY)
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('validation failed'),
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  });

  // --- API-level error in response body ---

  it('should handle API-level error in response body', async () => {
    const errorResponse = {
      id: 'chatcmpl-test',
      choices: [],
      error: { message: 'Model overloaded', code: 503 },
    };

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(errorResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      generateTest('Create a test', DEFAULT_CONFIG, TEST_API_KEY)
    ).rejects.toMatchObject({
      code: 'API_ERROR',
      message: 'Model overloaded',
    });
  });

  // --- 500 server error ---

  it('should retry on 5xx server errors', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(createValidResponse()) });
    vi.stubGlobal('fetch', mockFetch);

    const test = await generateTest('Create a test', DEFAULT_CONFIG, TEST_API_KEY);
    expect(test.questions).toHaveLength(5);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // --- 400 Bad Request - no retry ---

  it('should not retry on 400 Bad Request', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      generateTest('Create a test', DEFAULT_CONFIG, TEST_API_KEY)
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // --- Custom model parameter ---

  it('should accept a custom model parameter', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createValidResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    await generateTest('Create a test', DEFAULT_CONFIG, TEST_API_KEY, 'anthropic/claude-3-opus');

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.model).toBe('anthropic/claude-3-opus');
  });

  // --- Uses default model when not specified ---

  it('should use openai/gpt-4o as default model', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createValidResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    await generateTest('Create a test', DEFAULT_CONFIG, TEST_API_KEY);

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.model).toBe('openai/gpt-4o');
  });
});
