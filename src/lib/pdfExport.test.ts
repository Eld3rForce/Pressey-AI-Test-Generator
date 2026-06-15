// ============================================================
// PDF Export Service — Unit Tests
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Test, Question } from './types';

// --- Mock jsPDF ---

const mockDoc = {
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setTextColor: vi.fn(),
  text: vi.fn(),
  splitTextToSize: vi.fn((text: string, _maxWidth: number) => [text]),
  setDrawColor: vi.fn(),
  setLineWidth: vi.fn(),
  line: vi.fn(),
  addPage: vi.fn(),
  setPage: vi.fn(),
  getNumberOfPages: vi.fn(() => 1),
  output: vi.fn(() => new ArrayBuffer(64)),
};

vi.mock('jspdf', () => ({
  jsPDF: vi.fn(() => mockDoc),
}));

import { exportTestToPdf } from './pdfExport';

// --- Test Helpers ---

function createQuestion(overrides?: Partial<Question>): Question {
  return {
    type: 'mcq',
    text: 'What is 2 + 2?',
    options: ['3', '4', '5', '6'],
    correctAnswer: '4',
    explanation: 'Basic arithmetic.',
    orderIndex: 0,
    ...overrides,
  };
}

function createTest(overrides?: Partial<Test>): Test {
  return {
    title: 'Sample Test',
    topic: 'Mathematics',
    difficulty: 'Easy',
    questionCount: 3,
    mcqPercentage: 100,
    questions: [
      createQuestion({ orderIndex: 0, text: 'Q1: What is 1+1?', options: ['1', '2', '3', '4'], correctAnswer: '2', explanation: '1+1=2' }),
      createQuestion({ orderIndex: 1, text: 'Q2: What is 2+2?', options: ['3', '4', '5', '6'], correctAnswer: '4', explanation: '2+2=4' }),
      createQuestion({ orderIndex: 2, type: 'text', text: 'Explain the theory of relativity.', options: undefined, correctAnswer: 'E=mc²', explanation: 'Energy equals mass times speed of light squared.' }),
    ],
    createdAt: '2026-06-15T10:00:00Z',
    ...overrides,
  };
}

function resetMockDoc() {
  Object.values(mockDoc).forEach((fn) => {
    if (vi.isMockFunction(fn)) fn.mockClear();
  });
  mockDoc.getNumberOfPages.mockReturnValue(1);
  mockDoc.output.mockReturnValue(new ArrayBuffer(64));
  mockDoc.splitTextToSize.mockImplementation((text: string) => [text]);
}

// --- Tests ---

describe('exportTestToPdf', () => {
  beforeEach(() => {
    resetMockDoc();
  });

  it('returns a Uint8Array', async () => {
    const test = createTest();
    const result = await exportTestToPdf(test, false);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(mockDoc.output).toHaveBeenCalledWith('arraybuffer');
  });

  it('renders the test title on the title page', async () => {
    const test = createTest({ title: 'Advanced Calculus' });
    await exportTestToPdf(test, false);

    const allTextCalls = mockDoc.text.mock.calls.map((call: unknown[]) => call[0]);
    const joined = allTextCalls.flat().join(' ');
    expect(joined).toContain('Advanced Calculus');
  });

  it('renders topic, difficulty, question count, and date on title page', async () => {
    const test = createTest({
      topic: 'Physics',
      difficulty: 'Hard',
      createdAt: '2025-01-01T00:00:00Z',
    });
    await exportTestToPdf(test, false);

    const allTextCalls = mockDoc.text.mock.calls.map((call: unknown[]) => call[0]);
    const joined = allTextCalls.flat().join(' ');

    expect(joined).toContain('Physics');
    expect(joined).toContain('Hard');
    expect(joined).toContain('Questions: 3');
    expect(joined).toContain('01/01/2025');
  });

  it('renders all questions with their numbers', async () => {
    const test = createTest();
    await exportTestToPdf(test, false);

    const allTextCalls = mockDoc.text.mock.calls.map((call: unknown[]) => call[0]);
    const joined = allTextCalls.flat().join(' ');

    expect(joined).toContain('1.');
    expect(joined).toContain('2.');
    expect(joined).toContain('3.');
    expect(joined).toContain('Q1: What is 1+1?');
    expect(joined).toContain('Q2: What is 2+2?');
    expect(joined).toContain('Explain the theory of relativity');
  });

  it('renders MCQ options labeled A), B), C), D)', async () => {
    const test = createTest({
      questions: [
        createQuestion({
          orderIndex: 0,
          text: 'Capital of France?',
          options: ['London', 'Paris', 'Berlin', 'Madrid'],
          correctAnswer: 'Paris',
        }),
      ],
    });
    await exportTestToPdf(test, false);

    const allTextCalls = mockDoc.text.mock.calls.map((call: unknown[]) => call[0]);
    const joined = allTextCalls.flat().join(' ');

    expect(joined).toContain('A) London');
    expect(joined).toContain('B) Paris');
    expect(joined).toContain('C) Berlin');
    expect(joined).toContain('D) Madrid');
  });

  it('renders blank lines for text-type questions', async () => {
    const test = createTest({
      questions: [
        createQuestion({
          type: 'text',
          orderIndex: 0,
          text: 'Describe your approach.',
          options: undefined,
          correctAnswer: 'Any reasonable answer.',
        }),
      ],
    });
    await exportTestToPdf(test, false);

    // Should draw lines for blank answer space (4 per text question, plus title-page HR lines)
    expect(mockDoc.line.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('includes answer key when includeAnswerKey=true', async () => {
    const test = createTest({
      questions: [
        createQuestion({
          orderIndex: 0,
          text: 'What is 2+2?',
          options: ['3', '4', '5', '6'],
          correctAnswer: '4',
          explanation: 'Two plus two equals four.',
        }),
      ],
    });
    await exportTestToPdf(test, true);

    const allTextCalls = mockDoc.text.mock.calls.map((call: unknown[]) => call[0]);
    const joined = allTextCalls.flat().join(' ');

    expect(joined).toContain('Answer Key');
    expect(joined).toContain('Answer: 4');
    expect(joined).toContain('Two plus two equals four.');
  });

  it('excludes answer key when includeAnswerKey=false', async () => {
    const test = createTest();
    await exportTestToPdf(test, false);

    const allTextCalls = mockDoc.text.mock.calls.map((call: unknown[]) => call[0]);
    const joined = allTextCalls.flat().join(' ');

    expect(joined).not.toContain('Answer Key');
    expect(joined).not.toContain('Answer:');
  });

  it('handles empty question array gracefully', async () => {
    const test = createTest({ questions: [] });
    const result = await exportTestToPdf(test, true);

    // Should still produce a valid PDF
    expect(result).toBeInstanceOf(Uint8Array);
    expect(mockDoc.output).toHaveBeenCalledWith('arraybuffer');

    // Should not crash trying to include answer key for empty questions
    const allTextCalls = mockDoc.text.mock.calls.map((call: unknown[]) => call[0]);
    const joined = allTextCalls.flat().join(' ');
    expect(joined).not.toContain('Answer:');
  });

  it('includes page numbers on all pages', async () => {
    mockDoc.getNumberOfPages.mockReturnValue(3);
    const test = createTest();
    await exportTestToPdf(test, false);

    // setPage should be called for each page
    expect(mockDoc.setPage).toHaveBeenCalledWith(1);
    expect(mockDoc.setPage).toHaveBeenCalledWith(2);
    expect(mockDoc.setPage).toHaveBeenCalledWith(3);

    // Check page number text
    const allTextCalls = mockDoc.text.mock.calls.map((call: unknown[]) => call[0]);
    const joined = allTextCalls.flat().join(' ');
    expect(joined).toContain('Page 1 of 3');
    expect(joined).toContain('Page 2 of 3');
    expect(joined).toContain('Page 3 of 3');
  });

  it('includes "Generated by Pressey" footer text', async () => {
    const test = createTest();
    await exportTestToPdf(test, false);

    const allTextCalls = mockDoc.text.mock.calls.map((call: unknown[]) => call[0]);
    const joined = allTextCalls.flat().join(' ');
    expect(joined).toContain('Generated by Pressey AI Test Generator');
  });

  it('preserves question order matching test.questions array', async () => {
    const test = createTest({
      questions: [
        createQuestion({ orderIndex: 0, text: 'First question' }),
        createQuestion({ orderIndex: 1, text: 'Second question' }),
        createQuestion({ orderIndex: 2, text: 'Third question' }),
      ],
    });
    await exportTestToPdf(test, false);

    const allTextCalls = mockDoc.text.mock.calls.map((call: unknown[]) => call[0]);
    const joined = allTextCalls.flat().join(' ');

    const firstIdx = joined.indexOf('First question');
    const secondIdx = joined.indexOf('Second question');
    const thirdIdx = joined.indexOf('Third question');

    expect(firstIdx).toBeLessThan(secondIdx);
    expect(secondIdx).toBeLessThan(thirdIdx);
  });
});
