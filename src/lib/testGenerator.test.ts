import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateFromPrompt, generateFromFile } from './testGenerator';
import type { Test, TestConfig } from './types';

// ============================================================
// Mock the API module
// ============================================================

vi.mock('./api', () => ({
  generateTest: vi.fn(),
}));

import { generateTest } from './api';

// ============================================================
// Mock settingsStore (mutable settings for research flag tests)
// vi.mock factories are hoisted above module-scope `const`, so we use
// vi.hoisted() to create the shared mutable settings object.
// ============================================================

const { mockSettings } = vi.hoisted(() => ({
  mockSettings: {
    apiKey: '',
    model: 'openai/gpt-4o',
    defaultQuestionCount: 10,
    defaultMcqPercentage: 70,
    defaultDifficulty: 'Medium' as const,
    personality: 'none',
    customInstructions: '',
    provider: 'openrouter' as const,
    openaiKey: '',
    anthropicKey: '',
    geminiKey: '',
    ollamaUrl: 'http://localhost:11434',
    openrouterKey: '',
    includeMcq: true,
    includeText: true,
    enableResearch: false,
    researchMaxResults: 5,
    researchMaxSnippetChars: 800,
  },
}));

vi.mock('./settingsStore.svelte', () => ({
  settingsStore: {
    settings: mockSettings,
    loaded: true,
    error: null,
    loadSettings: vi.fn().mockResolvedValue(undefined),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    updateSetting: vi.fn().mockResolvedValue(undefined),
    testApiConnection: vi.fn().mockResolvedValue(true),
    resetToDefaults: vi.fn(),
  },
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

function createValidTest(overrides?: Partial<Test>): Test {
  return {
    title: 'JavaScript Fundamentals Test',
    topic: 'JavaScript',
    difficulty: 'Medium',
    questionCount: 5,
    mcqPercentage: 60,
    questions: [
      {
        type: 'mcq',
        text: 'What is a closure in JavaScript?',
        options: ['A function', 'A variable', 'A function with lexical scope', 'An object'],
        correctAnswer: 'A function with lexical scope',
        explanation: 'Closures capture variables from their outer lexical scope.',
        orderIndex: 0,
      },
      {
        type: 'mcq',
        text: 'What does `typeof null` return in JavaScript?',
        options: ['null', 'undefined', 'object', 'boolean'],
        correctAnswer: 'object',
        explanation: 'This is a well-known quirk in JavaScript.',
        orderIndex: 1,
      },
      {
        type: 'mcq',
        text: 'What is the result of 0.1 + 0.2 === 0.3?',
        options: ['true', 'false', 'undefined', 'NaN'],
        correctAnswer: 'false',
        explanation: 'Floating-point arithmetic causes precision loss.',
        orderIndex: 2,
      },
      {
        type: 'text',
        text: 'Explain event delegation in JavaScript.',
        correctAnswer: 'Event delegation uses a single event listener on a parent element to handle events from its children.',
        explanation: 'Leverages event bubbling for efficient event handling.',
        orderIndex: 3,
      },
      {
        type: 'text',
        text: 'What are the differences between `let`, `const`, and `var`?',
        correctAnswer: 'let and const are block-scoped; var is function-scoped. const cannot be reassigned.',
        explanation: 'Block scoping prevents hoisting issues and accidental redeclaration.',
        orderIndex: 4,
      },
    ],
    ...overrides,
  };
}

// ============================================================
// generateFromPrompt tests
// ============================================================

describe('generateFromPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Success: correct structure ---

  it('should return a correctly structured Test', async () => {
    vi.mocked(generateTest).mockResolvedValueOnce(createValidTest());

    const test = await generateFromPrompt('Focus on closures', DEFAULT_CONFIG, TEST_API_KEY);

    expect(test.title).toBe('JavaScript Fundamentals Test');
    expect(test.topic).toBe('JavaScript');
    expect(test.difficulty).toBe('Medium');
    expect(test.questionCount).toBe(5);
    expect(test.mcqPercentage).toBe(60);
    expect(test.questions).toHaveLength(5);

    // Check MCQ structure
    const mcqQuestions = test.questions.filter((q) => q.type === 'mcq');
    expect(mcqQuestions).toHaveLength(3);
    for (const q of mcqQuestions) {
      expect(q.options).toBeDefined();
      expect(q.options).toHaveLength(4);
      expect(q.options).toContain(q.correctAnswer);
      expect(q.explanation).toBeTruthy();
    }

    // Check text question structure
    const textQuestions = test.questions.filter((q) => q.type === 'text');
    expect(textQuestions).toHaveLength(2);
    for (const q of textQuestions) {
      expect(q.correctAnswer).toBeTruthy();
      expect(q.explanation).toBeTruthy();
    }
  });

  // --- Passes prompt and config to API ---

  it('should compose a rich prompt and pass it with config to the API', async () => {
    vi.mocked(generateTest).mockResolvedValueOnce(createValidTest());

    await generateFromPrompt('Focus on closures and prototypes', DEFAULT_CONFIG, TEST_API_KEY);

    expect(generateTest).toHaveBeenCalledTimes(1);

    const [prompt, config, apiKey] = vi.mocked(generateTest).mock.calls[0];

    // Prompt should contain the rich template instructions
    expect(prompt).toContain('Generate a test on the topic of');
    expect(prompt).toContain('JavaScript');
    expect(prompt).toContain('Exactly 5 total questions');
    expect(prompt).toContain('3 multiple choice questions (60%');
    expect(prompt).toContain('2 text response');
    expect(prompt).toContain('Difficulty level: Medium');
    expect(prompt).toContain('exactly 4 options');
    expect(prompt).toContain('Focus on closures and prototypes');
    expect(prompt).toContain('ADDITIONAL CONTEXT / INSTRUCTIONS');

    // Config and API key should be passed through unchanged
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(apiKey).toBe(TEST_API_KEY);
  });

  // --- Handles API error ---

  it('should propagate API errors without retrying', async () => {
    const apiError = new Error('API failure: rate limited');
    vi.mocked(generateTest).mockRejectedValueOnce(apiError);

    await expect(
      generateFromPrompt('Test prompt', DEFAULT_CONFIG, TEST_API_KEY)
    ).rejects.toThrow('API failure: rate limited');

    expect(generateTest).toHaveBeenCalledTimes(1);
  });

  it('should propagate ApiError objects correctly', async () => {
    const apiError = Object.assign(new Error('Invalid API key'), {
      code: 'AUTH_INVALID_KEY',
      status: 401,
    });
    vi.mocked(generateTest).mockRejectedValueOnce(apiError);

    await expect(
      generateFromPrompt('Test prompt', DEFAULT_CONFIG, TEST_API_KEY)
    ).rejects.toMatchObject({
      code: 'AUTH_INVALID_KEY',
      status: 401,
    });
  });

  // --- Validates question count ---

  it('should throw when question count does not match config', async () => {
    const badTest = createValidTest({
      questionCount: 5,
      questions: [
        {
          type: 'mcq',
          text: 'Q1?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: 'Because',
          orderIndex: 0,
        },
      ],
    });

    vi.mocked(generateTest).mockResolvedValueOnce(badTest);

    await expect(
      generateFromPrompt('Test', DEFAULT_CONFIG, TEST_API_KEY)
    ).rejects.toThrow('Question count mismatch: expected 5, got 1');
  });

  // --- Validates MCQ percentage distribution ---

  it('should throw when MCQ percentage distribution does not match config', async () => {
    const badTest = createValidTest({
      questions: [
        { type: 'text', text: 'Q1?', correctAnswer: 'A', explanation: 'x', orderIndex: 0 },
        { type: 'text', text: 'Q2?', correctAnswer: 'A', explanation: 'x', orderIndex: 1 },
        { type: 'text', text: 'Q3?', correctAnswer: 'A', explanation: 'x', orderIndex: 2 },
        { type: 'text', text: 'Q4?', correctAnswer: 'A', explanation: 'x', orderIndex: 3 },
        { type: 'text', text: 'Q5?', correctAnswer: 'A', explanation: 'x', orderIndex: 4 },
      ],
    });

    vi.mocked(generateTest).mockResolvedValueOnce(badTest);

    await expect(
      generateFromPrompt('Test', DEFAULT_CONFIG, TEST_API_KEY)
    ).rejects.toThrow('MCQ count mismatch: expected 3 (60%), got 0');
  });

  // --- Validates MCQ options count ---

  it('should throw when an MCQ question does not have exactly 4 options', async () => {
    const badTest = createValidTest({
      questions: [
        {
          type: 'mcq',
          text: 'Q1?',
          options: ['Only', 'Two'],
          correctAnswer: 'Only',
          explanation: 'x',
          orderIndex: 0,
        },
        {
          type: 'mcq',
          text: 'Q2?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: 'x',
          orderIndex: 1,
        },
        {
          type: 'mcq',
          text: 'Q3?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: 'x',
          orderIndex: 2,
        },
        { type: 'text', text: 'Q4?', correctAnswer: 'A', explanation: 'x', orderIndex: 3 },
        { type: 'text', text: 'Q5?', correctAnswer: 'A', explanation: 'x', orderIndex: 4 },
      ],
    });

    vi.mocked(generateTest).mockResolvedValueOnce(badTest);

    await expect(
      generateFromPrompt('Test', DEFAULT_CONFIG, TEST_API_KEY)
    ).rejects.toThrow('must have exactly 4 options, got 2');
  });

  // --- Validates correctAnswer in options ---

  it('should throw when MCQ correctAnswer is not among the options', async () => {
    const badTest = createValidTest({
      questions: [
        {
          type: 'mcq',
          text: 'Q1?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'Z - not in options',
          explanation: 'x',
          orderIndex: 0,
        },
        {
          type: 'mcq',
          text: 'Q2?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: 'x',
          orderIndex: 1,
        },
        {
          type: 'mcq',
          text: 'Q3?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: 'x',
          orderIndex: 2,
        },
        { type: 'text', text: 'Q4?', correctAnswer: 'A', explanation: 'x', orderIndex: 3 },
        { type: 'text', text: 'Q5?', correctAnswer: 'A', explanation: 'x', orderIndex: 4 },
      ],
    });

    vi.mocked(generateTest).mockResolvedValueOnce(badTest);

    await expect(
      generateFromPrompt('Test', DEFAULT_CONFIG, TEST_API_KEY)
    ).rejects.toThrow('is not among the provided options');
  });

  // --- Validates required fields ---

  it('should throw when a question is missing required fields', async () => {
    const badTest = createValidTest({
      questions: [
        { type: 'mcq', text: '', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'x', orderIndex: 0 },
        { type: 'mcq', text: 'Q2?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'x', orderIndex: 1 },
        { type: 'mcq', text: 'Q3?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'x', orderIndex: 2 },
        { type: 'text', text: 'Q4?', correctAnswer: 'A', explanation: 'x', orderIndex: 3 },
        { type: 'text', text: 'Q5?', correctAnswer: 'A', explanation: 'x', orderIndex: 4 },
      ],
    });

    vi.mocked(generateTest).mockResolvedValueOnce(badTest);

    await expect(
      generateFromPrompt('Test', DEFAULT_CONFIG, TEST_API_KEY)
    ).rejects.toThrow('missing required fields');
  });

  // --- Validates invalid question type ---

  it('should throw when a question has an invalid type', async () => {
    // Must have valid MCQ count (3) so we reach the per-question type check
    const badTest = createValidTest({
      questions: [
        { type: 'mcq', text: 'Q1?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'x', orderIndex: 0 },
        { type: 'mcq', text: 'Q2?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'x', orderIndex: 1 },
        { type: 'mcq', text: 'Q3?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'x', orderIndex: 2 },
        { type: 'text' as 'mcq', text: 'Q4?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'x', orderIndex: 3 },
        { type: 'essay' as 'mcq', text: 'Q5?', correctAnswer: 'A', explanation: 'x', orderIndex: 4 },
      ],
    });

    vi.mocked(generateTest).mockResolvedValueOnce(badTest);

    await expect(
      generateFromPrompt('Test', DEFAULT_CONFIG, TEST_API_KEY)
    ).rejects.toThrow('invalid type');
  });

  // --- Validates missing explanation ---

  it('should throw when a question is missing an explanation', async () => {
    const badTest = createValidTest({
      questions: [
        { type: 'mcq', text: 'Q1?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: '', orderIndex: 0 },
        { type: 'mcq', text: 'Q2?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'x', orderIndex: 1 },
        { type: 'mcq', text: 'Q3?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'x', orderIndex: 2 },
        { type: 'text', text: 'Q4?', correctAnswer: 'A', explanation: 'x', orderIndex: 3 },
        { type: 'text', text: 'Q5?', correctAnswer: 'A', explanation: 'x', orderIndex: 4 },
      ],
    });

    vi.mocked(generateTest).mockResolvedValueOnce(badTest);

    await expect(
      generateFromPrompt('Test', DEFAULT_CONFIG, TEST_API_KEY)
    ).rejects.toThrow('missing an explanation');
  });

  // --- Edge: 0% MCQ (all text) ---

  it('should handle 0% MCQ config (all text questions)', async () => {
    const allTextConfig: TestConfig = {
      questionCount: 3,
      mcqPercentage: 0,
      difficulty: 'Easy',
      topic: 'History',
    };

    const allTextTest = createValidTest({
      questionCount: 3,
      mcqPercentage: 0,
      questions: [
        { type: 'text', text: 'Q1?', correctAnswer: 'A', explanation: 'x', orderIndex: 0 },
        { type: 'text', text: 'Q2?', correctAnswer: 'A', explanation: 'x', orderIndex: 1 },
        { type: 'text', text: 'Q3?', correctAnswer: 'A', explanation: 'x', orderIndex: 2 },
      ],
    });

    vi.mocked(generateTest).mockResolvedValueOnce(allTextTest);

    const test = await generateFromPrompt('Test', allTextConfig, TEST_API_KEY);

    expect(test.questions).toHaveLength(3);
    expect(test.questions.every((q) => q.type === 'text')).toBe(true);
  });

  // --- Edge: 100% MCQ ---

  it('should handle 100% MCQ config', async () => {
    const allMcqConfig: TestConfig = {
      questionCount: 4,
      mcqPercentage: 100,
      difficulty: 'Hard',
      topic: 'Math',
    };

    const allMcqTest = createValidTest({
      questionCount: 4,
      mcqPercentage: 100,
      difficulty: 'Hard',
      questions: [
        { type: 'mcq', text: 'Q1?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'x', orderIndex: 0 },
        { type: 'mcq', text: 'Q2?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'x', orderIndex: 1 },
        { type: 'mcq', text: 'Q3?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'x', orderIndex: 2 },
        { type: 'mcq', text: 'Q4?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'x', orderIndex: 3 },
      ],
    });

    vi.mocked(generateTest).mockResolvedValueOnce(allMcqTest);

    const test = await generateFromPrompt('Test', allMcqConfig, TEST_API_KEY);

    expect(test.questions).toHaveLength(4);
    expect(test.questions.every((q) => q.type === 'mcq')).toBe(true);
    for (const q of test.questions) {
      expect(q.options).toHaveLength(4);
    }
  });

  // --- Default topic when not provided ---

  it('should use "general knowledge" when topic is not provided', async () => {
    vi.mocked(generateTest).mockResolvedValueOnce(createValidTest());

    const configWithoutTopic: TestConfig = {
      questionCount: 5,
      mcqPercentage: 60,
      difficulty: 'Medium',
    };

    await generateFromPrompt('Test', configWithoutTopic, TEST_API_KEY);

    const [prompt] = vi.mocked(generateTest).mock.calls[0];
    expect(prompt).toContain('"general knowledge"');
  });
});

// ============================================================
// generateFromFile tests
// ============================================================

describe('generateFromFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prepend file content as contextual prompt', async () => {
    vi.mocked(generateTest).mockResolvedValueOnce(createValidTest());

    const fileContent =
      'Closures are functions that remember their lexical scope. They are a fundamental concept in JavaScript.';
    const fileName = 'closures-notes.txt';

    await generateFromFile(fileContent, fileName, DEFAULT_CONFIG, TEST_API_KEY);

    expect(generateTest).toHaveBeenCalledTimes(1);

    const [prompt, config, apiKey] = vi.mocked(generateTest).mock.calls[0];

    // Should contain the file-based context wrapper
    expect(prompt).toContain('Generate a test based on the following content');
    expect(prompt).toContain('"closures-notes.txt"');
    expect(prompt).toContain('Closures are functions that remember their lexical scope');
    expect(prompt).toContain('ADDITIONAL CONTEXT / INSTRUCTIONS');

    // Config and apiKey should pass through unchanged
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(apiKey).toBe(TEST_API_KEY);
  });

  it('should handle empty file content gracefully', async () => {
    vi.mocked(generateTest).mockResolvedValueOnce(createValidTest());

    await generateFromFile('', 'empty.txt', DEFAULT_CONFIG, TEST_API_KEY);

    const [prompt] = vi.mocked(generateTest).mock.calls[0];

    expect(prompt).toContain('empty.txt');
    expect(prompt).toContain('Generate a test based on the following content');
  });

  it('should handle multi-line file content', async () => {
    vi.mocked(generateTest).mockResolvedValueOnce(createValidTest());

    const multiLineContent = `# JavaScript Basics

## Variables
- let: block-scoped
- const: block-scoped, cannot be reassigned
- var: function-scoped

## Functions
- Arrow functions do not have their own 'this'`;

    await generateFromFile(multiLineContent, 'js-basics.md', DEFAULT_CONFIG, TEST_API_KEY);

    const [prompt] = vi.mocked(generateTest).mock.calls[0];

    expect(prompt).toContain('js-basics.md');
    expect(prompt).toContain('# JavaScript Basics');
    expect(prompt).toContain('Arrow functions');
    expect(prompt).toContain('block-scoped');
  });

  it('should handle API errors from generateFromPrompt', async () => {
    vi.mocked(generateTest).mockRejectedValueOnce(new Error('Network failure'));

    await expect(
      generateFromFile('Some content', 'notes.txt', DEFAULT_CONFIG, TEST_API_KEY)
    ).rejects.toThrow('Network failure');
  });

  it('should validate the generated test structure', async () => {
    const badTest = createValidTest({
      questions: [
        { type: 'mcq', text: 'Q1?', options: ['A'], correctAnswer: 'A', explanation: 'x', orderIndex: 0 },
        { type: 'mcq', text: 'Q2?', options: ['A','B','C','D'], correctAnswer: 'A', explanation: 'x', orderIndex: 1 },
        { type: 'mcq', text: 'Q3?', options: ['A','B','C','D'], correctAnswer: 'A', explanation: 'x', orderIndex: 2 },
        { type: 'text', text: 'Q4?', correctAnswer: 'A', explanation: 'x', orderIndex: 3 },
        { type: 'text', text: 'Q5?', correctAnswer: 'A', explanation: 'x', orderIndex: 4 },
      ],
    });

    vi.mocked(generateTest).mockResolvedValueOnce(badTest);

    await expect(
      generateFromFile('Content', 'doc.txt', DEFAULT_CONFIG, TEST_API_KEY)
    ).rejects.toThrow('must have exactly 4 options');
  });

  it('should include userPrompt content in the generated prompt when provided', async () => {
    vi.mocked(generateTest).mockResolvedValueOnce(createValidTest());

    const fileContent = 'Some study material about JavaScript closures.';
    const fileName = 'closures.txt';
    const userPrompt = 'Focus on practical examples and real-world use cases.';

    await generateFromFile(fileContent, fileName, DEFAULT_CONFIG, TEST_API_KEY, undefined, userPrompt);

    expect(generateTest).toHaveBeenCalledTimes(1);

    const [prompt] = vi.mocked(generateTest).mock.calls[0];

    // Should contain the file-based context
    expect(prompt).toContain('Generate a test based on the following content');
    expect(prompt).toContain('closures.txt');

    // Should contain the additional user instructions
    expect(prompt).toContain('ADDITIONAL USER INSTRUCTIONS:');
    expect(prompt).toContain('Focus on practical examples and real-world use cases.');
  });

  it('should not add ADDITIONAL USER INSTRUCTIONS block when userPrompt is empty', async () => {
    vi.mocked(generateTest).mockResolvedValueOnce(createValidTest());

    await generateFromFile('Content', 'test.txt', DEFAULT_CONFIG, TEST_API_KEY);

    const [prompt] = vi.mocked(generateTest).mock.calls[0];

    expect(prompt).toContain('Generate a test based on the following content');
    expect(prompt).not.toContain('ADDITIONAL USER INSTRUCTIONS:');
  });
});

// ============================================================
// Research integration tests (opt-in settings flag)
// ============================================================

const VALID_DDG_HTML = `
<!DOCTYPE html>
<html>
<body>
  <div class="result">
    <h2 class="result__title">
      <a class="result__a" href="https://example.com/js-closures">Closures in JavaScript</a>
    </h2>
    <a class="result__snippet" href="https://example.com/js-closures">
      Closures capture variables from their outer lexical scope and are a fundamental JavaScript concept.
    </a>
  </div>
  <div class="result">
    <h2 class="result__title">
      <a class="result__a" href="https://example.com/js-promises">Promises Explained</a>
    </h2>
    <a class="result__snippet" href="https://example.com/js-promises">
      A Promise represents a value that may be available now, later, or never in asynchronous code.
    </a>
  </div>
</body>
</html>
`;

function makeDdgFetchMock(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(VALID_DDG_HTML),
  });
}

describe('research integration', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings.enableResearch = false;
    mockSettings.researchMaxResults = 5;
    mockSettings.researchMaxSnippetChars = 800;
    fetchMock = makeDdgFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not call fetch when enableResearch is false', async () => {
    vi.mocked(generateTest).mockResolvedValueOnce(createValidTest());
    mockSettings.enableResearch = false;

    await generateFromPrompt('Focus on closures', DEFAULT_CONFIG, TEST_API_KEY);

    expect(fetchMock).not.toHaveBeenCalled();
    const [prompt] = vi.mocked(generateTest).mock.calls[0];
    expect(prompt).not.toContain('RESEARCH CONTEXT:');
  });

  it('appends RESEARCH CONTEXT block with web snippet when enableResearch is true', async () => {
    vi.mocked(generateTest).mockResolvedValueOnce(createValidTest());
    mockSettings.enableResearch = true;

    await generateFromPrompt('Focus on closures', DEFAULT_CONFIG, TEST_API_KEY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain(encodeURIComponent('JavaScript'));

    const [prompt] = vi.mocked(generateTest).mock.calls[0];
    expect(prompt).toContain('ADDITIONAL CONTEXT / INSTRUCTIONS');
    expect(prompt).toContain('RESEARCH CONTEXT:');
    expect(prompt).toContain('--- Web Results ---');
    expect(prompt).toContain('[Web 1] Closures in JavaScript');
    expect(prompt).toContain('lexical scope');
    expect(prompt).toContain('Source: https://example.com/js-closures');

    const addIdx = prompt.indexOf('ADDITIONAL CONTEXT / INSTRUCTIONS');
    const researchIdx = prompt.indexOf('RESEARCH CONTEXT:');
    expect(researchIdx).toBeGreaterThan(addIdx);
  });

  it('passes file content as uploaded text for document search in generateFromFile', async () => {
    vi.mocked(generateTest).mockResolvedValueOnce(createValidTest());
    mockSettings.enableResearch = true;

    const fileContent =
      'Closures capture variables from their outer lexical scope. ' +
      'Closures are used in callbacks and event handlers throughout JavaScript.';

    await generateFromFile(fileContent, 'js-notes.txt', DEFAULT_CONFIG, TEST_API_KEY);

    const [prompt] = vi.mocked(generateTest).mock.calls[0];
    expect(prompt).toContain('RESEARCH CONTEXT:');
    expect(prompt).toContain('--- Document Excerpts ---');
    expect(prompt).toContain('[Doc 1]');
  });

  it('completes generation without throwing when research fetch rejects', async () => {
    const rejectingFetch = vi.fn().mockRejectedValue(new Error('Network down'));
    vi.stubGlobal('fetch', rejectingFetch);
    vi.mocked(generateTest).mockResolvedValueOnce(createValidTest());
    mockSettings.enableResearch = true;

    const test = await generateFromPrompt('Focus on closures', DEFAULT_CONFIG, TEST_API_KEY);

    expect(test).toBeDefined();
    expect(test.questions).toHaveLength(5);
    expect(rejectingFetch).toHaveBeenCalledTimes(1);

    const [prompt] = vi.mocked(generateTest).mock.calls[0];
    expect(prompt).toContain('ADDITIONAL CONTEXT / INSTRUCTIONS');
    expect(prompt).not.toContain('RESEARCH CONTEXT:');
    expect(warnSpy).toHaveBeenCalled();
    const warnCall = warnSpy.mock.calls.map((c) => c.join(' ')).join(' | ');
    expect(warnCall).toContain('RESEARCH_FETCH_FAILED');
  });
});
