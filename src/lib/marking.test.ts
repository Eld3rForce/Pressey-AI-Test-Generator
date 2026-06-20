import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateMarking } from './marking';
import type { Test, Settings } from './types';

// ── Mock sleep so tests don't actually wait ────────────────────────────
vi.mock('./utils', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock providers/registry ────────────────────────────────────────────
const { mockGetProviderConfig, mockGetProviderKey } = vi.hoisted(() => ({
  mockGetProviderConfig: vi.fn(),
  mockGetProviderKey: vi.fn(),
}));

vi.mock('./providers/registry', () => ({
  getProviderConfig: mockGetProviderConfig,
  getProviderKey: mockGetProviderKey,
}));

// ============================================================
// Test data
// ============================================================

const SAMPLE_SETTINGS: Settings = {
  apiKey: '',
  model: 'openai/gpt-4o',
  defaultQuestionCount: 10,
  defaultMcqPercentage: 70,
  defaultDifficulty: 'Medium',
  openrouterKey: 'sk-or-v1-test-key-12345',
};

/**
 * A test with 1 MCQ + 3 text questions so we can exercise all paths.
 *   Q1: mcq
 *   Q2: text (has user answer)
 *   Q3: text (has user answer)
 *   Q4: text (empty user answer → skipped)
 */
const SAMPLE_TEST: Test = {
  id: 1,
  title: 'Marking Test',
  topic: 'Science',
  difficulty: 'Medium',
  questionCount: 4,
  mcqPercentage: 50,
  questions: [
    {
      id: 1, type: 'mcq', text: 'What is H2O?',
      options: ['Water', 'Fire', 'Earth', 'Air'],
      correctAnswer: 'Water', orderIndex: 0,
    },
    {
      id: 2, type: 'text', text: 'Explain photosynthesis',
      correctAnswer: 'Plants convert sunlight to energy', orderIndex: 1,
    },
    {
      id: 3, type: 'text', text: 'What is gravity?',
      correctAnswer: 'A force attracting masses', orderIndex: 2,
    },
    {
      id: 4, type: 'text', text: 'Why is the sky blue?',
      correctAnswer: 'Rayleigh scattering', orderIndex: 3,
    },
  ],
};

function createMarkingResponse(overrides?: unknown) {
  return {
    id: 'chatcmpl-marking',
    choices: [
      {
        message: {
          content: JSON.stringify(
            overrides ?? {
              markings: [
                { questionId: 2, isCorrect: true },
                { questionId: 3, isCorrect: true },
              ],
            },
          ),
        },
        finish_reason: 'stop',
      },
    ],
  };
}

function createEmptyMarkingResponse() {
  return {
    id: 'chatcmpl-marking',
    choices: [
      {
        message: {
          content: JSON.stringify({ markings: [] }),
        },
        finish_reason: 'stop',
      },
    ],
  };
}

// ============================================================
// Tests
// ============================================================

describe('generateMarking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProviderConfig.mockReturnValue({
      url: 'https://openrouter.ai/api/v1/chat/completions',
      keyField: 'openrouterKey',
      defaultModel: 'openai/gpt-4o',
      headers: {
        'HTTP-Referer': 'https://pressey.app',
        'X-Title': 'Pressey AI Test Generator',
      },
    });
    mockGetProviderKey.mockReturnValue('sk-or-v1-test-key-12345');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── All text questions answered correctly ──────────────────────────

  it('should return true for all text questions when LLM marks them correct', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createMarkingResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    const answers = new Map<number, string>([
      [1, 'Water'],        // MCQ — not sent to LLM, should return null
      [2, 'Plants convert sunlight'],  // text — correct
      [3, 'Force attracting masses'],  // text — correct
      // Q4 not provided → empty → false
    ]);

    const result = await generateMarking(SAMPLE_TEST, answers, SAMPLE_SETTINGS);

    // MCQ returns null
    expect(result.get(1)).toBeNull();
    // Text questions LLM marked correct
    expect(result.get(2)).toBe(true);
    expect(result.get(3)).toBe(true);
    // Empty text answer
    expect(result.get(4)).toBe(false);
    expect(result.size).toBe(4);
  });

  // ── Mixed correct/incorrect ────────────────────────────────────────

  it('should return mixed booleans when LLM marks some correct and some incorrect', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(
        createMarkingResponse({
          markings: [
            { questionId: 2, isCorrect: true },
            { questionId: 3, isCorrect: false },
          ],
        }),
      ),
    });
    vi.stubGlobal('fetch', mockFetch);

    const answers = new Map<number, string>([
      [1, 'Water'],
      [2, 'Plants convert sunlight'],
      [3, 'Wrong answer about gravity'],
      [4, 'Some answer for Q4'],
    ]);

    const result = await generateMarking(SAMPLE_TEST, answers, SAMPLE_SETTINGS);

    expect(result.get(1)).toBeNull();       // MCQ
    expect(result.get(2)).toBe(true);       // correct
    expect(result.get(3)).toBe(false);      // incorrect
    // Q4 was sent to LLM but not in LLM response → defaults to false
    expect(result.get(4)).toBe(false);
  });

  // ── MCQ questions → null ───────────────────────────────────────────

  it('should return null for all MCQ questions without calling the LLM', async () => {
    // All-MCQ test
    const allMcqTest: Test = {
      id: 2,
      title: 'MCQ Only Test',
      topic: 'Science',
      difficulty: 'Easy',
      questionCount: 2,
      mcqPercentage: 100,
      questions: [
        { id: 1, type: 'mcq', text: 'Q1?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', orderIndex: 0 },
        { id: 2, type: 'mcq', text: 'Q2?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B', orderIndex: 1 },
      ],
    };

    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const answers = new Map<number, string>([
      [1, 'A'],
      [2, 'B'],
    ]);

    const result = await generateMarking(allMcqTest, answers, SAMPLE_SETTINGS);

    expect(result.get(1)).toBeNull();
    expect(result.get(2)).toBeNull();
    expect(result.size).toBe(2);
    // fetch should NOT have been called (no text questions to mark)
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── Empty text answer → false ──────────────────────────────────────

  it('should return false for empty text answers without calling the LLM', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const answers = new Map<number, string>([
      [1, 'Water'],
      [2, ''],          // empty → false
      [3, '   '],       // whitespace → false
      [4, ''],          // empty → false
    ]);

    const result = await generateMarking(SAMPLE_TEST, answers, SAMPLE_SETTINGS);

    expect(result.get(1)).toBeNull();  // MCQ
    expect(result.get(2)).toBe(false); // empty text
    expect(result.get(3)).toBe(false); // whitespace text
    expect(result.get(4)).toBe(false); // empty text
    // No text questions with content → fetch not called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── TODO: All-text questions with all-correct markings ──
  // (covered by first test above)

  // ── Single text question ────────────────────────────────────────────

  it('should handle a single text question correctly', async () => {
    const singleTextTest: Test = {
      id: 3,
      title: 'Single Text',
      topic: 'Science',
      difficulty: 'Medium',
      questionCount: 1,
      mcqPercentage: 0,
      questions: [
        { id: 1, type: 'text', text: 'Explain E=mc^2', correctAnswer: 'Energy equals mass times speed of light squared', orderIndex: 0 },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(
        createMarkingResponse({
          markings: [{ questionId: 1, isCorrect: true }],
        }),
      ),
    });
    vi.stubGlobal('fetch', mockFetch);

    const answers = new Map<number, string>([[1, 'Energy equals mass times c squared']]);

    const result = await generateMarking(singleTextTest, answers, SAMPLE_SETTINGS);

    expect(result.get(1)).toBe(true);
    expect(result.size).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // ── Handles HTTP errors ────────────────────────────────────────────

  it('should throw on HTTP 500 errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    const answers = new Map<number, string>([
      [2, 'Plants convert sunlight'],
      [3, 'Force attracting masses'],
    ]);

    await expect(
      generateMarking(SAMPLE_TEST, answers, SAMPLE_SETTINGS),
    ).rejects.toMatchObject({
      code: 'SERVER_ERROR',
      status: 500,
    });
  });

  // ── Handles invalid JSON ───────────────────────────────────────────

  it('should throw on malformed JSON in API response', async () => {
    const badResponse = {
      id: 'chatcmpl-marking',
      choices: [{ message: { content: 'not json {{{' }, finish_reason: 'stop' }],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(badResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    const answers = new Map<number, string>([
      [2, 'Plants convert sunlight'],
    ]);

    await expect(
      generateMarking(SAMPLE_TEST, answers, SAMPLE_SETTINGS),
    ).rejects.toMatchObject({
      code: 'MALFORMED_JSON',
    });
  });

  // ── Validation error (wrong schema) ────────────────────────────────

  it('should throw on Zod validation error when response has wrong structure', async () => {
    const invalidResponse = {
      id: 'chatcmpl-marking',
      choices: [
        {
          message: {
            content: JSON.stringify({ markings: [{ questionId: 'not-a-number', isCorrect: 'not-boolean' }] }),
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

    const answers = new Map<number, string>([
      [2, 'Plants convert sunlight'],
    ]);

    await expect(
      generateMarking(SAMPLE_TEST, answers, SAMPLE_SETTINGS),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('validation failed'),
    });
  });

  // ── Empty LLM response (no markings) → all text defaults to false ──

  it('should default unreturned text questions to false', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createEmptyMarkingResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    const answers = new Map<number, string>([
      [2, 'Plants convert sunlight'],
      [3, 'Force attracting masses'],
    ]);

    const result = await generateMarking(SAMPLE_TEST, answers, SAMPLE_SETTINGS);

    // MCQ still null
    expect(result.get(1)).toBeNull();
    // LLM returned empty markings → both text questions default to false
    expect(result.get(2)).toBe(false);
    expect(result.get(3)).toBe(false);
    // Q4 not in answers map → treated as empty → set to false
    expect(result.get(4)).toBe(false);
  });
});
