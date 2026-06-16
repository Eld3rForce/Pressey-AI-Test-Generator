import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateExplanations } from './explanations';
import type { Test, Attempt } from './types';

vi.mock('./utils', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
  cn: vi.fn((...inputs: string[]) => inputs.join(' ')),
}));

const { mockGetResponses } = vi.hoisted(() => ({
  mockGetResponses: vi.fn(),
}));

vi.mock('./dbService', () => ({
  getResponses: mockGetResponses,
  saveExplanations: vi.fn(),
  getExplanations: vi.fn(),
  getSettings: vi.fn(),
}));

const TEST_API_KEY = 'sk-or-v1-test-key-12345';

const sampleTest: Test = {
  id: 1,
  title: 'JavaScript Basics',
  topic: 'JavaScript',
  difficulty: 'Medium',
  questionCount: 3,
  mcqPercentage: 66,
  questions: [
    {
      id: 101,
      testId: 1,
      type: 'mcq',
      text: 'What does `typeof null` return?',
      options: ['null', 'undefined', 'object', 'boolean'],
      correctAnswer: 'object',
      explanation: 'This is a known JavaScript quirk.',
      orderIndex: 0,
    },
    {
      id: 102,
      testId: 1,
      type: 'mcq',
      text: 'What is a closure?',
      options: ['A loop', 'A function with lexical scope', 'A variable', 'A class'],
      correctAnswer: 'A function with lexical scope',
      explanation: 'Closures capture variables from outer scope.',
      orderIndex: 1,
    },
    {
      id: 103,
      testId: 1,
      type: 'text',
      text: 'Explain hoisting in JavaScript.',
      correctAnswer: 'Hoisting moves declarations to the top of their scope.',
      orderIndex: 2,
    },
  ],
};

const sampleAttempt: Attempt = {
  id: 1,
  testId: 1,
  startedAt: '2025-01-01T00:00:00Z',
  completedAt: '2025-01-01T00:05:00Z',
  score: 33,
  totalQuestions: 3,
};

function createExplanationResponse(overrides?: Record<string, unknown>) {
  return {
    id: 'chatcmpl-test-exp',
    choices: [
      {
        message: {
          content: JSON.stringify(
            overrides || {
              explanation: '`typeof null` returns "object" due to a legacy bug in the first version of JavaScript where the type tag for null was 0, the same as objects.',
              userMistake: 'The user may have expected "null" since it seems intuitive that typeof null would return "null", but JavaScript does not behave this way.',
              resources: [
                { title: 'MDN: typeof', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof', type: 'documentation' },
                { title: 'Understanding the typeof null bug', url: 'https://2ality.com/2013/10/typeof-null.html', type: 'article' },
              ],
            }
          ),
        },
        finish_reason: 'stop',
      },
    ],
  };
}

describe('generateExplanations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetResponses.mockResolvedValue([
      { id: 1, attemptId: 1, questionId: 101, userAnswer: 'null', isCorrect: false },
      { id: 2, attemptId: 1, questionId: 102, userAnswer: 'A loop', isCorrect: false },
      { id: 3, attemptId: 1, questionId: 103, userAnswer: 'Hoisting moves declarations down.', isCorrect: false },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate explanations for all wrong answers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createExplanationResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    const explanations = await generateExplanations(sampleAttempt, sampleTest, TEST_API_KEY);

    expect(explanations).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    for (const exp of explanations) {
      expect(exp).toMatchObject({
        attemptId: 1,
        explanation: expect.any(String),
        userMistake: expect.any(String),
        resources: expect.any(Array),
      });
      expect(exp.resources.length).toBeGreaterThanOrEqual(1);
      for (const resource of exp.resources) {
        expect(resource).toMatchObject({
          title: expect.any(String),
          url: expect.stringMatching(/^https?:\/\//),
          type: expect.stringMatching(/^(article|video|documentation|book)$/),
        });
      }
    }
  });

  it('should return empty array when all answers are correct', async () => {
    mockGetResponses.mockResolvedValue([
      { id: 1, attemptId: 1, questionId: 101, userAnswer: 'object', isCorrect: true },
      { id: 2, attemptId: 1, questionId: 102, userAnswer: 'A function with lexical scope', isCorrect: true },
    ]);

    const explanations = await generateExplanations(sampleAttempt, sampleTest, TEST_API_KEY);

    expect(explanations).toHaveLength(0);
  });

  it('should skip questions not found in the test', async () => {
    mockGetResponses.mockResolvedValue([
      { id: 1, attemptId: 1, questionId: 999, userAnswer: 'wrong', isCorrect: false },
    ]);

    const explanations = await generateExplanations(sampleAttempt, sampleTest, TEST_API_KEY);

    expect(explanations).toHaveLength(0);
  });

  it('should throw when attempt has no id', async () => {
    const attemptWithoutId: Attempt = { testId: 1 };

    await expect(
      generateExplanations(attemptWithoutId, sampleTest, TEST_API_KEY)
    ).rejects.toThrow('Attempt must have an id');
  });

  it('should handle HTTP error responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      generateExplanations(sampleAttempt, sampleTest, TEST_API_KEY)
    ).rejects.toMatchObject({
      code: 'SERVER_ERROR',
      status: 500,
    });
  });

  it('should handle invalid JSON in response', async () => {
    const badResponse = {
      id: 'chatcmpl-test',
      choices: [{ message: { content: 'not json {{{' }, finish_reason: 'stop' }],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(badResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      generateExplanations(sampleAttempt, sampleTest, TEST_API_KEY)
    ).rejects.toMatchObject({
      code: 'MALFORMED_JSON',
    });
  });

  it('should validate response with Zod schema and fail on invalid structure', async () => {
    const invalidResponse = {
      id: 'chatcmpl-test',
      choices: [
        {
          message: {
            content: JSON.stringify({ explanation: 'Missing required fields' }),
          },
          finish_reason: 'stop',
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(invalidResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      generateExplanations(sampleAttempt, sampleTest, TEST_API_KEY)
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('validation failed'),
    });
  });

  it('should handle API-level error in response body', async () => {
    const errorResponse = {
      id: 'chatcmpl-test',
      choices: [],
      error: { message: 'Model overloaded', code: 503 },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(errorResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      generateExplanations(sampleAttempt, sampleTest, TEST_API_KEY)
    ).rejects.toMatchObject({
      code: 'API_ERROR',
      message: 'Model overloaded (code: 503)',
    });
  });

  it('should handle empty response content', async () => {
    const emptyResponse = {
      id: 'chatcmpl-test',
      choices: [{ message: { content: '' }, finish_reason: 'stop' }],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptyResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      generateExplanations(sampleAttempt, sampleTest, TEST_API_KEY)
    ).rejects.toMatchObject({
      code: 'EMPTY_RESPONSE',
    });
  });

  it('should use default model when not specified', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createExplanationResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    await generateExplanations(sampleAttempt, sampleTest, TEST_API_KEY);

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.model).toBe('openai/gpt-4o');
  });

  it('should accept a custom model parameter', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createExplanationResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    await generateExplanations(sampleAttempt, sampleTest, TEST_API_KEY, 'anthropic/claude-3-opus');

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.model).toBe('anthropic/claude-3-opus');
  });

  it('should handle 401 invalid API key without retry', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      generateExplanations(sampleAttempt, sampleTest, TEST_API_KEY)
    ).rejects.toMatchObject({
      code: 'AUTH_INVALID_KEY',
      status: 401,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should handle 400 bad request without retry', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      generateExplanations(sampleAttempt, sampleTest, TEST_API_KEY)
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should construct prompts with question details and options', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createExplanationResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    await generateExplanations(sampleAttempt, sampleTest, TEST_API_KEY);

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const userMessage = requestBody.messages.find((m: { role: string }) => m.role === 'user');

    expect(userMessage.content).toContain('What does `typeof null` return?');
    expect(userMessage.content).toContain('A. null');
    expect(userMessage.content).toContain('B. undefined');
    expect(userMessage.content).toContain('C. object');
    expect(userMessage.content).toContain('D. boolean');
    expect(userMessage.content).toContain('Correct answer: object');
    expect(userMessage.content).toContain("User's wrong answer: null");
    expect(userMessage.content).toContain('Question type: mcq');
  });

  it('should handle (no answer) for skipped questions', async () => {
    mockGetResponses.mockResolvedValue([
      { id: 1, attemptId: 1, questionId: 101, userAnswer: '', isCorrect: false },
    ]);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createExplanationResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    await generateExplanations(sampleAttempt, sampleTest, TEST_API_KEY);

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const userMessage = requestBody.messages.find((m: { role: string }) => m.role === 'user');
    expect(userMessage.content).toContain("User's wrong answer: (no answer)");
  });

  it('should work with OpenAI provider', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createExplanationResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    const explanations = await generateExplanations(
      sampleAttempt,
      sampleTest,
      'sk-test-openai-key-12345',
      'gpt-4o',
      'openai',
    );

    expect(explanations).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Verify the endpoint URL is OpenAI's
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('should work with explicit settings object', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createExplanationResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    const explanations = await generateExplanations(
      sampleAttempt,
      sampleTest,
      'sk-or-v1-override-key',
      'anthropic/claude-opus-4',
      'openrouter',
      {
        apiKey: 'sk-or-v1-override-key',
        model: 'anthropic/claude-opus-4',
        defaultQuestionCount: 10,
        defaultMcqPercentage: 50,
        defaultDifficulty: 'Medium',
        openrouterKey: 'sk-or-v1-override-key',
      },
    );

    expect(explanations).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.model).toBe('anthropic/claude-opus-4');
  });

  it('should use default Ollama endpoint when provider is ollama and no custom URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createExplanationResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    await generateExplanations(
      sampleAttempt,
      sampleTest,
      'ollama-key',
      'llama3.2',
      'ollama',
    );

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('should use custom Ollama endpoint when provider is ollama with custom ollamaUrl', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createExplanationResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    await generateExplanations(
      sampleAttempt,
      sampleTest,
      'ollama-key',
      'llama3.2',
      'ollama',
      {
        apiKey: 'ollama-key',
        model: 'llama3.2',
        defaultQuestionCount: 10,
        defaultMcqPercentage: 50,
        defaultDifficulty: 'Medium',
        ollamaUrl: 'http://custom:11434',
      },
    );

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe('http://custom:11434/v1/chat/completions');
  });

  it('should use OpenRouter endpoint when provider is openrouter', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createExplanationResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    await generateExplanations(
      sampleAttempt,
      sampleTest,
      TEST_API_KEY,
      'openai/gpt-4o',
      'openrouter',
    );

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe('https://openrouter.ai/api/v1/chat/completions');
  });
});
