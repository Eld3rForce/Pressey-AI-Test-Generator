import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PERSONALITIES,
  getPersonality,
  buildPersonalityPrefix,
} from './personalities';
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
    title: 'Test',
    topic: 'JavaScript',
    difficulty: 'Medium',
    questionCount: 5,
    mcqPercentage: 60,
    questions: [
      {
        type: 'mcq',
        text: 'Q1?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Because',
        orderIndex: 0,
      },
      {
        type: 'mcq',
        text: 'Q2?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Because',
        orderIndex: 1,
      },
      {
        type: 'mcq',
        text: 'Q3?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Because',
        orderIndex: 2,
      },
      { type: 'text', text: 'Q4?', correctAnswer: 'A', explanation: 'x', orderIndex: 3 },
      { type: 'text', text: 'Q5?', correctAnswer: 'A', explanation: 'x', orderIndex: 4 },
    ],
    ...overrides,
  };
}

// ============================================================
// Personality definitions
// ============================================================

describe('PERSONALITIES', () => {
  it('should have exactly 6 pre-defined personalities', () => {
    expect(PERSONALITIES).toHaveLength(6);
  });

  it('each personality should have id, name, description, and systemPrompt', () => {
    for (const p of PERSONALITIES) {
      expect(p.id).toBeTruthy();
      expect(typeof p.id).toBe('string');
      expect(p.name).toBeTruthy();
      expect(typeof p.name).toBe('string');
      expect(p.description).toBeTruthy();
      expect(typeof p.description).toBe('string');
      expect(p.systemPrompt).toBeTruthy();
      expect(typeof p.systemPrompt).toBe('string');
      // systemPrompt should be substantial (at least 50 chars of instruction)
      expect(p.systemPrompt.length).toBeGreaterThan(50);
    }
  });

  it('should have all expected personality ids', () => {
    const ids = PERSONALITIES.map((p) => p.id);
    expect(ids).toContain('friendly-tutor');
    expect(ids).toContain('strict-professor');
    expect(ids).toContain('encouraging-coach');
    expect(ids).toContain('socratic-guide');
    expect(ids).toContain('concise-expert');
    expect(ids).toContain('snarky-tutor');
  });

  it('should not have duplicate ids', () => {
    const ids = PERSONALITIES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ============================================================
// getPersonality
// ============================================================

describe('getPersonality', () => {
  it('should return the correct personality by id', () => {
    const p = getPersonality('friendly-tutor');
    expect(p).toBeDefined();
    expect(p!.name).toBe('Friendly Tutor');
  });

  it('should return undefined for unknown id', () => {
    expect(getPersonality('nonexistent')).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    expect(getPersonality('')).toBeUndefined();
  });

  it('should return each pre-defined personality', () => {
    for (const p of PERSONALITIES) {
      const found = getPersonality(p.id);
      expect(found).toBe(p);
    }
  });
});

// ============================================================
// buildPersonalityPrefix
// ============================================================

describe('buildPersonalityPrefix', () => {
  it('should return empty string when personalityId is undefined', () => {
    expect(buildPersonalityPrefix(undefined)).toBe('');
  });

  it('should return empty string when personalityId is "none"', () => {
    expect(buildPersonalityPrefix('none')).toBe('');
  });

  it('should return empty string when personalityId is empty string', () => {
    expect(buildPersonalityPrefix('')).toBe('');
  });

  it('should return the systemPrompt for a valid pre-defined personality', () => {
    const result = buildPersonalityPrefix('friendly-tutor');
    const friendly = getPersonality('friendly-tutor')!;
    expect(result).toBe(friendly.systemPrompt);
  });

  it('should return the systemPrompt for strict-professor personality', () => {
    const result = buildPersonalityPrefix('strict-professor');
    const strict = getPersonality('strict-professor')!;
    expect(result).toBe(strict.systemPrompt);
  });

  it('should return custom instructions when personalityId is "custom"', () => {
    const result = buildPersonalityPrefix('custom', 'Be extremely sarcastic.');
    expect(result).toBe('Be extremely sarcastic.');
  });

  it('should trim custom instructions', () => {
    const result = buildPersonalityPrefix('custom', '  Be precise.  ');
    expect(result).toBe('Be precise.');
  });

  it('should return empty string for custom with empty instructions', () => {
    expect(buildPersonalityPrefix('custom', '')).toBe('');
    expect(buildPersonalityPrefix('custom', '   ')).toBe('');
  });

  it('should return empty string for custom with undefined instructions', () => {
    expect(buildPersonalityPrefix('custom', undefined)).toBe('');
  });

  it('should return empty string for unknown personalityId', () => {
    expect(buildPersonalityPrefix('unknown-personality')).toBe('');
  });

  it('buildPersonalityPrefix(\'snarky-tutor\') should return a non-empty string starting with "You are"', () => {
    const result = buildPersonalityPrefix('snarky-tutor');
    expect(result).toBeTruthy();
    expect(result.startsWith('You are')).toBe(true);
  });

  it('buildPersonalityPrefix(\'snarky-tutor\') should contain snarky/sarcastic content', () => {
    const result = buildPersonalityPrefix('snarky-tutor');
    expect(result.length).toBeGreaterThan(50);
    const snarky = getPersonality('snarky-tutor')!;
    expect(result).toBe(snarky.systemPrompt);
  });
});

// ============================================================
// Integration: personality prompt passed to API
// ============================================================

describe('generateFromPrompt with personality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass personalityPrompt as systemPrefix to generateTest', async () => {
    vi.mocked(generateTest).mockResolvedValueOnce(createValidTest());

    const personalityPrompt = buildPersonalityPrefix('friendly-tutor');

    await generateFromPrompt('Test prompt', DEFAULT_CONFIG, TEST_API_KEY, personalityPrompt);

    expect(generateTest).toHaveBeenCalledTimes(1);
    const args = vi.mocked(generateTest).mock.calls[0];
    // args: [prompt, config, apiKey, model, systemPrefix]
    expect(args[4]).toBe(personalityPrompt);
  });

  it('should pass undefined systemPrefix when no personalityPrompt provided', async () => {
    vi.mocked(generateTest).mockResolvedValueOnce(createValidTest());

    await generateFromPrompt('Test prompt', DEFAULT_CONFIG, TEST_API_KEY);

    const args = vi.mocked(generateTest).mock.calls[0];
    expect(args[4]).toBeUndefined();
  });

  it('should pass custom instructions as systemPrefix', async () => {
    vi.mocked(generateTest).mockResolvedValueOnce(createValidTest());

    const personalityPrompt = buildPersonalityPrefix('custom', 'Use pirate speak.');

    await generateFromPrompt('Test prompt', DEFAULT_CONFIG, TEST_API_KEY, personalityPrompt);

    const args = vi.mocked(generateTest).mock.calls[0];
    expect(args[4]).toBe('Use pirate speak.');
  });
});

describe('generateFromFile with personality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass personalityPrompt through to generateFromPrompt', async () => {
    vi.mocked(generateTest).mockResolvedValueOnce(createValidTest());

    const personalityPrompt = buildPersonalityPrefix('concise-expert');

    await generateFromFile('Some file content', 'notes.txt', DEFAULT_CONFIG, TEST_API_KEY, personalityPrompt);

    // generateFromFile delegates to generateFromPrompt, which calls generateTest
    const args = vi.mocked(generateTest).mock.calls[0];
    expect(args[4]).toBe(personalityPrompt);
  });

  it('should work without personalityPrompt (backward compatible)', async () => {
    vi.mocked(generateTest).mockResolvedValueOnce(createValidTest());

    await generateFromFile('Some content', 'notes.txt', DEFAULT_CONFIG, TEST_API_KEY);

    expect(generateTest).toHaveBeenCalledTimes(1);
  });
});
