import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared mock state ─────────────────────────────────────────────────
const { mockExecute, mockSelect, mockInitDatabase } = vi.hoisted(() => ({
  mockExecute: vi.fn().mockResolvedValue({ rowsAffected: 1, lastInsertId: 1 }),
  mockSelect: vi.fn().mockResolvedValue([]),
  mockInitDatabase: vi.fn(),
}));

vi.mock('./db', () => ({
  initDatabase: mockInitDatabase,
  _resetForTest: vi.fn(),
}));

import {
  createTest,
  getTest,
  getAllTests,
  deleteTest,
  createAttempt,
  completeAttempt,
  getAttempts,
  getAttempt,
  createPartialAttempt,
  getInProgressAttempt,
  cancelPartialAttempt,
  updateAttemptProgress,
  saveResponse,
  saveResponses,
  getResponses,
  getSettings,
  saveSetting,
  deleteSetting,
} from './dbService';
import type { Test, Response } from './types';

// ── Helpers ──────────────────────────────────────────────────────────
function mockDb() {
  return { execute: mockExecute, select: mockSelect };
}

function executedSqls(): string[] {
  return mockExecute.mock.calls.map((call: unknown[]) => call[0] as string);
}

function executedBindings(): unknown[][] {
  return mockExecute.mock.calls.map((call: unknown[]) => call[1] as unknown[]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInitDatabase.mockResolvedValue(mockDb());
  mockExecute.mockResolvedValue({ rowsAffected: 1, lastInsertId: 1 });
  mockSelect.mockResolvedValue([]);
});

// ── createTest ────────────────────────────────────────────────────────
describe('createTest', () => {
  const sampleTest: Test = {
    title: 'Sample Test',
    topic: 'TypeScript',
    difficulty: 'Medium',
    questionCount: 2,
    mcqPercentage: 50,
    questions: [
      {
        type: 'mcq',
        text: 'What is 1+1?',
        options: ['1', '2', '3', '4'],
        correctAnswer: '2',
        orderIndex: 0,
      },
      {
        type: 'text',
        text: 'Explain closures',
        correctAnswer: 'A closure is...',
        orderIndex: 1,
      },
    ],
  };

  it('inserts test row with correct values', async () => {
    mockExecute.mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 42 });

    const testId = await createTest(sampleTest);

    expect(testId).toBe(42);

    const sqls = executedSqls();
    const testInsert = sqls[0];
    expect(testInsert).toContain('INSERT INTO tests');
    expect(testInsert).toContain('title, topic, difficulty, question_count, mcq_percentage');

    const testBindings = executedBindings()[0];
    expect(testBindings).toEqual(['Sample Test', 'TypeScript', 'Medium', 2, 50]);
  });

  it('inserts all questions with correct test ID', async () => {
    mockExecute
      .mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 42 })
      .mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 100 })
      .mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 101 });

    await createTest(sampleTest);

    // 1 test INSERT + 2 question INSERTs = 3 calls
    expect(mockExecute).toHaveBeenCalledTimes(3);

    // First question
    const q1Bindings = executedBindings()[1];
    expect(q1Bindings[0]).toBe(42); // test_id
    expect(q1Bindings[1]).toBe('mcq');
    expect(q1Bindings[2]).toBe('What is 1+1?');
    // options stored as JSON
    expect(q1Bindings[3]).toBe('["1","2","3","4"]');
    expect(q1Bindings[4]).toBe('2');
    expect(q1Bindings[6]).toBe(0); // order_index

    // Second question (text type, no options)
    const q2Bindings = executedBindings()[2];
    expect(q2Bindings[0]).toBe(42);
    expect(q2Bindings[1]).toBe('text');
    expect(q2Bindings[3]).toBe('[]'); // empty options array serialized
  });

  it('serializes question options to JSON', async () => {
    mockExecute.mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 1 });

    const testWithOptions: Test = {
      title: 'Q Test',
      difficulty: 'Easy',
      questionCount: 1,
      mcqPercentage: 100,
      questions: [
        {
          type: 'mcq',
          text: 'Pick one',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'C',
          orderIndex: 0,
        },
      ],
    };

    await createTest(testWithOptions);

    const qBinding = executedBindings()[1];
    expect(qBinding[3]).toBe('["A","B","C","D"]');
  });

  it('handles undefined topic and question options gracefully', async () => {
    mockExecute.mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 1 });

    const minimalTest: Test = {
      title: 'Minimal',
      difficulty: 'Easy',
      questionCount: 1,
      mcqPercentage: 0,
      questions: [
        {
          type: 'text',
          text: 'Describe X',
          correctAnswer: 'Y',
          orderIndex: 0,
        },
      ],
    };

    await createTest(minimalTest);

    const testBindings = executedBindings()[0];
    expect(testBindings[1]).toBeNull(); // topic → null

    const qBinding = executedBindings()[1];
    expect(qBinding[3]).toBe('[]'); // no options → []
    expect(qBinding[5]).toBeNull(); // no explanation → null
  });

  it('propagates database errors', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB write error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(createTest(sampleTest)).rejects.toThrow('DB write error');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

// ── getTest ───────────────────────────────────────────────────────────
describe('getTest', () => {
  it('returns null when no test row matches', async () => {
    mockSelect.mockResolvedValueOnce([]);

    const result = await getTest(999);
    expect(result).toBeNull();
  });

  it('fetches test and joined questions', async () => {
    mockSelect
      .mockResolvedValueOnce([
        {
          id: 1,
          title: 'Test A',
          topic: 'Math',
          difficulty: 'Hard',
          question_count: 2,
          mcq_percentage: 50,
          created_at: '2024-01-01',
          updated_at: '2024-01-02',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 10,
          test_id: 1,
          type: 'mcq',
          text: 'Q1',
          options: '["A","B","C","D"]',
          correct_answer: 'B',
          explanation: 'Because',
          order_index: 0,
        },
        {
          id: 11,
          test_id: 1,
          type: 'text',
          text: 'Q2',
          options: null,
          correct_answer: '42',
          explanation: null,
          order_index: 1,
        },
      ]);

    const test = await getTest(1);

    expect(test).not.toBeNull();
    expect(test!.id).toBe(1);
    expect(test!.title).toBe('Test A');
    expect(test!.topic).toBe('Math');
    expect(test!.difficulty).toBe('Hard');
    expect(test!.questions).toHaveLength(2);

    // MCQ question — options parsed from JSON
    expect(test!.questions[0].options).toEqual(['A', 'B', 'C', 'D']);
    expect(test!.questions[0].explanation).toBe('Because');

    // Text question — options fallback to empty array
    expect(test!.questions[1].options).toEqual([]);
    expect(test!.questions[1].explanation).toBeUndefined();

    // Verify correct SELECT queries
    const selectCalls = mockSelect.mock.calls;
    expect(selectCalls[0][0]).toContain('SELECT * FROM tests WHERE id');
    expect(selectCalls[1][0]).toContain('SELECT * FROM questions WHERE test_id');
    expect(selectCalls[1][0]).toContain('ORDER BY order_index');
  });

  it('handles invalid JSON in options gracefully', async () => {
    mockSelect
      .mockResolvedValueOnce([
        {
          id: 1,
          title: 'X',
          topic: null,
          difficulty: 'Easy',
          question_count: 1,
          mcq_percentage: 0,
          created_at: '',
          updated_at: '',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          test_id: 1,
          type: 'text',
          text: 'Q',
          options: 'not-valid-json{{{',
          correct_answer: 'A',
          explanation: null,
          order_index: 0,
        },
      ]);

    const test = await getTest(1);
    expect(test!.questions[0].options).toEqual([]);
  });

  it('propagates database errors', async () => {
    mockSelect.mockRejectedValueOnce(new Error('DB read error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getTest(1)).rejects.toThrow('DB read error');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

// ── getAllTests ───────────────────────────────────────────────────────
describe('getAllTests', () => {
  it('returns empty array when no tests exist', async () => {
    mockSelect.mockResolvedValueOnce([]);

    const tests = await getAllTests();
    expect(tests).toEqual([]);
  });

  it('returns tests with live question counts from JOIN', async () => {
    mockSelect.mockResolvedValueOnce([
      {
        id: 1,
        title: 'Test 1',
        topic: null,
        difficulty: 'Easy',
        question_count: 10,
        mcq_percentage: 50,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        live_question_count: 3,
      },
      {
        id: 2,
        title: 'Test 2',
        topic: 'Science',
        difficulty: 'Medium',
        question_count: 5,
        mcq_percentage: 100,
        created_at: '2024-01-02',
        updated_at: '2024-01-02',
        live_question_count: 5,
      },
    ]);

    const tests = await getAllTests();

    expect(tests).toHaveLength(2);
    expect(tests[0].id).toBe(1);
    expect(tests[0].questionCount).toBe(3); // live count, not stored count
    expect(tests[0].questions).toEqual([]); // empty array for list view
    expect(tests[1].id).toBe(2);
    expect(tests[1].topic).toBe('Science');
    expect(tests[1].questionCount).toBe(5);

    const selectSql = mockSelect.mock.calls[0][0] as string;
    expect(selectSql).toContain('LEFT JOIN questions');
    expect(selectSql).toContain('GROUP BY t.id');
    expect(selectSql).toContain('ORDER BY t.created_at DESC');
  });

  it('propagates database errors', async () => {
    mockSelect.mockRejectedValueOnce(new Error('List error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getAllTests()).rejects.toThrow('List error');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

// ── deleteTest ────────────────────────────────────────────────────────
describe('deleteTest', () => {
  it('deletes test by id', async () => {
    await deleteTest(42);

    const sql = executedSqls()[0];
    expect(sql).toContain('DELETE FROM tests WHERE id');
    expect(executedBindings()[0]).toEqual([42]);
  });

  it('propagates database errors', async () => {
    mockExecute.mockRejectedValueOnce(new Error('Delete error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(deleteTest(1)).rejects.toThrow('Delete error');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

// ── createAttempt ─────────────────────────────────────────────────────
describe('createAttempt', () => {
  it('inserts attempt with test_id and returns lastInsertId', async () => {
    mockExecute.mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 99 });

    const id = await createAttempt(7);

    expect(id).toBe(99);

    const sql = executedSqls()[0];
    expect(sql).toContain('INSERT INTO attempts');
    expect(sql).toContain('test_id');
    expect(executedBindings()[0]).toEqual([7]);
  });

  it('propagates database errors', async () => {
    mockExecute.mockRejectedValueOnce(new Error('Attempt error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(createAttempt(1)).rejects.toThrow('Attempt error');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

// ── completeAttempt ───────────────────────────────────────────────────
describe('completeAttempt', () => {
  it('updates attempt with score and completed_at', async () => {
    await completeAttempt(5, 85.5, 10);

    const sql = executedSqls()[0];
    expect(sql).toContain('UPDATE attempts');
    expect(sql).toContain('completed_at');
    expect(sql).toContain('score');
    expect(sql).toContain('total_questions');
    expect(sql).toContain('WHERE id = ?');

    const bindings = executedBindings()[0];
    expect(bindings[0]).toBe(85.5);
    expect(bindings[1]).toBe(10);
    expect(bindings[2]).toBe(5);
  });

  it('propagates database errors', async () => {
    mockExecute.mockRejectedValueOnce(new Error('Complete error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(completeAttempt(1, 100, 10)).rejects.toThrow('Complete error');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

// ── getAttempts ───────────────────────────────────────────────────────
describe('getAttempts', () => {
  it('returns mapped attempts for a test', async () => {
    mockSelect.mockResolvedValueOnce([
      {
        id: 1,
        test_id: 10,
        started_at: '2024-01-01T10:00:00',
        completed_at: '2024-01-01T10:30:00',
        score: 8.5,
        total_questions: 10,
      },
      {
        id: 2,
        test_id: 10,
        started_at: '2024-01-02T10:00:00',
        completed_at: null,
        score: null,
        total_questions: null,
      },
    ]);

    const attempts = await getAttempts(10);

    expect(attempts).toHaveLength(2);
    expect(attempts[0].id).toBe(1);
    expect(attempts[0].testId).toBe(10);
    expect(attempts[0].score).toBe(8.5);

    // In-progress attempt has undefined completed fields
    expect(attempts[1].completedAt).toBeUndefined();
    expect(attempts[1].score).toBeUndefined();

    const sql = mockSelect.mock.calls[0][0] as string;
    expect(sql).toContain('WHERE test_id');
    expect(sql).toContain('ORDER BY started_at DESC');
  });

  it('propagates database errors', async () => {
    mockSelect.mockRejectedValueOnce(new Error('List error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getAttempts(1)).rejects.toThrow('List error');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

// ── getAttempt ────────────────────────────────────────────────────────
describe('getAttempt', () => {
  it('returns null when no attempt matches', async () => {
    mockSelect.mockResolvedValueOnce([]);

    const result = await getAttempt(999);
    expect(result).toBeNull();
  });

  it('returns a single mapped attempt', async () => {
    mockSelect.mockResolvedValueOnce([
      {
        id: 42,
        test_id: 7,
        started_at: '2024-03-01T12:00:00',
        completed_at: null,
        score: null,
        total_questions: null,
      },
    ]);

    const attempt = await getAttempt(42);

    expect(attempt).not.toBeNull();
    expect(attempt!.id).toBe(42);
    expect(attempt!.testId).toBe(7);
    expect(attempt!.startedAt).toBe('2024-03-01T12:00:00');
    expect(attempt!.completedAt).toBeUndefined();
    expect(attempt!.score).toBeUndefined();
    expect(attempt!.totalQuestions).toBeUndefined();
  });

  it('propagates database errors', async () => {
    mockSelect.mockRejectedValueOnce(new Error('Fetch error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getAttempt(1)).rejects.toThrow('Fetch error');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

// ── partial attempt CRUD ─────────────────────────────────────────────
describe('partial attempt CRUD', () => {
  it('createPartialAttempt inserts a new partial attempt with current_index', async () => {
    mockSelect.mockResolvedValueOnce([]);
    mockExecute.mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 50 });

    const id = await createPartialAttempt(7, 3);

    expect(id).toBe(50);

    const selectSql = mockSelect.mock.calls[0][0] as string;
    expect(selectSql).toContain('WHERE test_id = ?');
    expect(selectSql).toContain('completed_at IS NULL');
    expect(selectSql).toContain('ORDER BY started_at DESC');
    expect(selectSql).toContain('LIMIT 1');
    expect(mockSelect.mock.calls[0][1]).toEqual([7]);

    const insertSql = mockExecute.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO attempts');
    expect(insertSql).toContain('test_id');
    expect(insertSql).toContain('current_index');
    expect(mockExecute.mock.calls[0][1]).toEqual([7, 3]);
  });

  it('createPartialAttempt upserts: second call updates the existing partial attempt', async () => {
    // First call: no existing partial → INSERT, returns new id 50
    mockSelect.mockResolvedValueOnce([]);
    mockExecute.mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 50 });

    const id1 = await createPartialAttempt(7, 3);
    expect(id1).toBe(50);

    // Second call: existing partial found → UPDATE, returns same id 50
    mockSelect.mockResolvedValueOnce([
      {
        id: 50,
        test_id: 7,
        started_at: '2024-01-01T10:00:00',
        completed_at: null,
        score: null,
        total_questions: null,
        current_index: 3,
      },
    ]);
    mockExecute.mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 50 });

    const id2 = await createPartialAttempt(7, 7);
    expect(id2).toBe(50);

    const insertCalls = mockExecute.mock.calls.filter((c: unknown[]) =>
      (c[0] as string).includes('INSERT INTO attempts')
    );
    const updateCalls = mockExecute.mock.calls.filter((c: unknown[]) =>
      (c[0] as string).includes('UPDATE attempts SET current_index')
    );
    expect(insertCalls).toHaveLength(1);
    expect(updateCalls).toHaveLength(1);

    const updateBindings = mockExecute.mock.calls
      .map((c: unknown[]) => c[1] as unknown[])
      .find((b: unknown[]) => Array.isArray(b) && b.length === 2 && b[0] === 7 && b[1] === 50);
    expect(updateBindings).toEqual([7, 50]);
  });

  it('getInProgressAttempt returns the most recent partial attempt', async () => {
    mockSelect.mockResolvedValueOnce([
      {
        id: 12,
        test_id: 7,
        started_at: '2024-01-02T10:00:00',
        completed_at: null,
        score: null,
        total_questions: null,
        current_index: 5,
      },
    ]);

    const attempt = await getInProgressAttempt(7);

    expect(attempt).not.toBeNull();
    expect(attempt!.id).toBe(12);
    expect(attempt!.testId).toBe(7);
    expect(attempt!.completedAt).toBeUndefined();
    expect(attempt!.currentIndex).toBe(5);

    const sql = mockSelect.mock.calls[0][0] as string;
    expect(sql).toContain('WHERE test_id = ?');
    expect(sql).toContain('completed_at IS NULL');
    expect(sql).toContain('ORDER BY started_at DESC');
    expect(sql).toContain('LIMIT 1');
  });

  it('getInProgressAttempt returns null when no partial attempt exists', async () => {
    mockSelect.mockResolvedValueOnce([]);

    const result = await getInProgressAttempt(7);
    expect(result).toBeNull();
  });

  it('cancelPartialAttempt deletes the partial attempt', async () => {
    await cancelPartialAttempt(50);

    const sql = mockExecute.mock.calls[0][0] as string;
    expect(sql).toContain('DELETE FROM attempts WHERE id = ?');
    expect(mockExecute.mock.calls[0][1]).toEqual([50]);
  });

  it('updateAttemptProgress updates current_index', async () => {
    await updateAttemptProgress(50, 4);

    const sql = mockExecute.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE attempts SET current_index = ?');
    expect(sql).toContain('WHERE id = ?');
    expect(mockExecute.mock.calls[0][1]).toEqual([4, 50]);
  });

  it('propagates database errors from createPartialAttempt', async () => {
    mockSelect.mockRejectedValueOnce(new Error('Upsert error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(createPartialAttempt(1, 0)).rejects.toThrow('Upsert error');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });

  it('propagates database errors from getInProgressAttempt', async () => {
    mockSelect.mockRejectedValueOnce(new Error('Resume error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getInProgressAttempt(1)).rejects.toThrow('Resume error');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

// ── saveResponse ──────────────────────────────────────────────────────
describe('saveResponse', () => {
  it('inserts response with correct values', async () => {
    const response: Response = {
      attemptId: 5,
      questionId: 10,
      userAnswer: 'Paris',
      isCorrect: true,
    };

    await saveResponse(response);

    const sql = executedSqls()[0];
    expect(sql).toContain('INSERT INTO responses');
    expect(sql).toContain('attempt_id');
    expect(sql).toContain('question_id');
    expect(sql).toContain('user_answer');
    expect(sql).toContain('is_correct');

    const bindings = executedBindings()[0];
    expect(bindings).toEqual([5, 10, 'Paris', 1]); // boolean → 1
  });

  it('converts isCorrect false to integer 0', async () => {
    const response: Response = {
      attemptId: 1,
      questionId: 1,
      userAnswer: 'Wrong',
      isCorrect: false,
    };

    await saveResponse(response);

    expect(executedBindings()[0][3]).toBe(0);
  });

  it('propagates database errors', async () => {
    mockExecute.mockRejectedValueOnce(new Error('Save error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      saveResponse({ attemptId: 1, questionId: 1, userAnswer: '', isCorrect: false })
    ).rejects.toThrow('Save error');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

// ── saveResponses ─────────────────────────────────────────────────────
describe('saveResponses', () => {
  it('batch saves all responses sequentially', async () => {
    const responses: Response[] = [
      { attemptId: 1, questionId: 1, userAnswer: 'A', isCorrect: true },
      { attemptId: 1, questionId: 2, userAnswer: 'B', isCorrect: false },
      { attemptId: 1, questionId: 3, userAnswer: 'C', isCorrect: true },
    ];

    await saveResponses(responses);

    expect(mockExecute).toHaveBeenCalledTimes(3);

    const allBindings = executedBindings();
    expect(allBindings[0]).toEqual([1, 1, 'A', 1]);
    expect(allBindings[1]).toEqual([1, 2, 'B', 0]);
    expect(allBindings[2]).toEqual([1, 3, 'C', 1]);
  });

  it('propagates error and stops on failure', async () => {
    mockExecute
      .mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 1 })
      .mockRejectedValueOnce(new Error('Batch save failed'));

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const responses: Response[] = [
      { attemptId: 1, questionId: 1, userAnswer: 'A', isCorrect: true },
      { attemptId: 1, questionId: 2, userAnswer: 'B', isCorrect: false },
    ];

    await expect(saveResponses(responses)).rejects.toThrow('Batch save failed');
    // First response was inserted, second failed
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

// ── getResponses ──────────────────────────────────────────────────────
describe('getResponses', () => {
  it('returns mapped responses with isCorrect as boolean', async () => {
    mockSelect.mockResolvedValueOnce([
      {
        id: 1,
        attempt_id: 5,
        question_id: 10,
        user_answer: 'Paris',
        is_correct: 1,
      },
      {
        id: 2,
        attempt_id: 5,
        question_id: 11,
        user_answer: 'Wrong',
        is_correct: 0,
      },
      {
        id: 3,
        attempt_id: 5,
        question_id: 12,
        user_answer: null,
        is_correct: 0,
      },
    ]);

    const responses = await getResponses(5);

    expect(responses).toHaveLength(3);

    expect(responses[0].isCorrect).toBe(true);
    expect(responses[0].userAnswer).toBe('Paris');

    expect(responses[1].isCorrect).toBe(false);

    // null user_answer → empty string
    expect(responses[2].userAnswer).toBe('');

    const sql = mockSelect.mock.calls[0][0] as string;
    expect(sql).toContain('WHERE attempt_id');
    expect(mockSelect.mock.calls[0][1]).toEqual([5]);
  });

  it('propagates database errors', async () => {
    mockSelect.mockRejectedValueOnce(new Error('Read error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getResponses(1)).rejects.toThrow('Read error');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

// ── getSettings ───────────────────────────────────────────────────────
describe('getSettings', () => {
  it('returns defaults when settings table is empty', async () => {
    mockSelect.mockResolvedValueOnce([]);

    const settings = await getSettings();

    expect(settings.apiKey).toBe('');
    expect(settings.model).toBe('openai/gpt-4o');
    expect(settings.defaultQuestionCount).toBe(10);
    expect(settings.defaultMcqPercentage).toBe(50);
    expect(settings.defaultDifficulty).toBe('Medium');
    expect(settings.personality).toBeUndefined();
    expect(settings.customInstructions).toBeUndefined();
  });

  it('parses numeric settings from stored strings', async () => {
    mockSelect.mockResolvedValueOnce([
      { key: 'apiKey', value: 'sk-123' },
      { key: 'model', value: 'openai/gpt-3.5-turbo' },
      { key: 'defaultQuestionCount', value: '25' },
      { key: 'defaultMcqPercentage', value: '75' },
      { key: 'defaultDifficulty', value: 'Hard' },
      { key: 'personality', value: 'Friendly tutor' },
      { key: 'customInstructions', value: 'Be concise' },
    ]);

    const settings = await getSettings();

    expect(settings.apiKey).toBe('sk-123');
    expect(settings.model).toBe('openai/gpt-3.5-turbo');
    expect(settings.defaultQuestionCount).toBe(25);
    expect(settings.defaultMcqPercentage).toBe(75);
    expect(settings.defaultDifficulty).toBe('Hard');
    expect(settings.personality).toBe('Friendly tutor');
    expect(settings.customInstructions).toBe('Be concise');
  });

  it('merges partial settings with defaults', async () => {
    mockSelect.mockResolvedValueOnce([
      { key: 'apiKey', value: 'sk-abc' },
      // missing model, questionCount, etc.
    ]);

    const settings = await getSettings();

    expect(settings.apiKey).toBe('sk-abc');
    expect(settings.model).toBe('openai/gpt-4o'); // default
    expect(settings.defaultQuestionCount).toBe(10); // default
  });

  it('returns openaiKey when stored via saveSetting', async () => {
    await saveSetting('openaiKey', 'sk-openai-test');
    mockSelect.mockResolvedValueOnce([{ key: 'openaiKey', value: 'sk-openai-test' }]);

    const settings = await getSettings();
    expect(settings.openaiKey).toBe('sk-openai-test');
  });

  it('returns anthropicKey when stored via saveSetting', async () => {
    await saveSetting('anthropicKey', 'sk-anthropic-test');
    mockSelect.mockResolvedValueOnce([{ key: 'anthropicKey', value: 'sk-anthropic-test' }]);

    const settings = await getSettings();
    expect(settings.anthropicKey).toBe('sk-anthropic-test');
  });

  it('returns geminiKey when stored via saveSetting', async () => {
    await saveSetting('geminiKey', 'sk-gemini-test');
    mockSelect.mockResolvedValueOnce([{ key: 'geminiKey', value: 'sk-gemini-test' }]);

    const settings = await getSettings();
    expect(settings.geminiKey).toBe('sk-gemini-test');
  });

  it('returns ollamaUrl when stored via saveSetting', async () => {
    await saveSetting('ollamaUrl', 'http://localhost:11434');
    mockSelect.mockResolvedValueOnce([{ key: 'ollamaUrl', value: 'http://localhost:11434' }]);

    const settings = await getSettings();
    expect(settings.ollamaUrl).toBe('http://localhost:11434');
  });

  it('returns openrouterKey when stored via saveSetting', async () => {
    await saveSetting('openrouterKey', 'sk-openrouter-test');
    mockSelect.mockResolvedValueOnce([{ key: 'openrouterKey', value: 'sk-openrouter-test' }]);

    const settings = await getSettings();
    expect(settings.openrouterKey).toBe('sk-openrouter-test');
  });

  it('returns provider when stored via saveSetting', async () => {
    await saveSetting('provider', 'openai');
    mockSelect.mockResolvedValueOnce([{ key: 'provider', value: 'openai' }]);

    const settings = await getSettings();
    expect(settings.provider).toBe('openai');
  });

  it('returns includeMcq parsed as boolean', async () => {
    await saveSetting('includeMcq', 'true');
    mockSelect.mockResolvedValueOnce([{ key: 'includeMcq', value: 'true' }]);

    const settings = await getSettings();
    expect(settings.includeMcq).toBe(true);
  });

  it('returns includeText parsed as boolean', async () => {
    await saveSetting('includeText', 'false');
    mockSelect.mockResolvedValueOnce([{ key: 'includeText', value: 'false' }]);

    const settings = await getSettings();
    expect(settings.includeText).toBe(false);
  });

  it('returns legacy apiKey AND per-provider keys together', async () => {
    await saveSetting('apiKey', 'sk-legacy');
    await saveSetting('openaiKey', 'sk-openai');
    await saveSetting('anthropicKey', 'sk-anthropic');
    await saveSetting('geminiKey', 'sk-gemini');
    await saveSetting('ollamaUrl', 'http://localhost:11434');
    await saveSetting('openrouterKey', 'sk-openrouter');
    await saveSetting('provider', 'anthropic');
    await saveSetting('includeMcq', 'true');
    await saveSetting('includeText', 'false');
    mockSelect.mockResolvedValueOnce([
      { key: 'apiKey', value: 'sk-legacy' },
      { key: 'openaiKey', value: 'sk-openai' },
      { key: 'anthropicKey', value: 'sk-anthropic' },
      { key: 'geminiKey', value: 'sk-gemini' },
      { key: 'ollamaUrl', value: 'http://localhost:11434' },
      { key: 'openrouterKey', value: 'sk-openrouter' },
      { key: 'provider', value: 'anthropic' },
      { key: 'includeMcq', value: 'true' },
      { key: 'includeText', value: 'false' },
    ]);

    const settings = await getSettings();

    expect(settings.apiKey).toBe('sk-legacy');
    expect(settings.openaiKey).toBe('sk-openai');
    expect(settings.anthropicKey).toBe('sk-anthropic');
    expect(settings.geminiKey).toBe('sk-gemini');
    expect(settings.ollamaUrl).toBe('http://localhost:11434');
    expect(settings.openrouterKey).toBe('sk-openrouter');
    expect(settings.provider).toBe('anthropic');
    expect(settings.includeMcq).toBe(true);
    expect(settings.includeText).toBe(false);
  });

  it('returns undefined for missing per-provider keys (not empty string)', async () => {
    mockSelect.mockResolvedValueOnce([]);

    const settings = await getSettings();

    expect(settings.openaiKey).toBeUndefined();
    expect(settings.anthropicKey).toBeUndefined();
    expect(settings.geminiKey).toBeUndefined();
    expect(settings.ollamaUrl).toBeUndefined();
    expect(settings.openrouterKey).toBeUndefined();
    expect(settings.provider).toBeUndefined();
    expect(settings.includeMcq).toBeUndefined();
    expect(settings.includeText).toBeUndefined();
  });

  it('propagates database errors', async () => {
    mockSelect.mockRejectedValueOnce(new Error('Settings error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getSettings()).rejects.toThrow('Settings error');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

// ── saveSetting ───────────────────────────────────────────────────────
describe('saveSetting', () => {
  it('upserts a setting with INSERT OR REPLACE', async () => {
    await saveSetting('apiKey', 'sk-xyz');

    const sql = executedSqls()[0];
    expect(sql).toContain('INSERT OR REPLACE INTO settings');
    expect(executedBindings()[0]).toEqual(['apiKey', 'sk-xyz']);
  });

  it('propagates database errors', async () => {
    mockExecute.mockRejectedValueOnce(new Error('Upsert error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(saveSetting('key', 'val')).rejects.toThrow('Upsert error');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

// ── deleteSetting ─────────────────────────────────────────────────────
describe('deleteSetting', () => {
  it('deletes a setting by key', async () => {
    await deleteSetting('apiKey');

    const sql = executedSqls()[0];
    expect(sql).toContain('DELETE FROM settings WHERE key');
    expect(executedBindings()[0]).toEqual(['apiKey']);
  });

  it('propagates database errors', async () => {
    mockExecute.mockRejectedValueOnce(new Error('Delete setting error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(deleteSetting('key')).rejects.toThrow('Delete setting error');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

// ── initDatabase usage ────────────────────────────────────────────────
describe('initDatabase integration', () => {
  it('calls initDatabase exactly once per operation', async () => {
    mockSelect.mockResolvedValue([]);

    await getSettings();

    expect(mockInitDatabase).toHaveBeenCalledTimes(1);
  });

  it('propagates initDatabase failures', async () => {
    mockInitDatabase.mockRejectedValueOnce(new Error('Connection lost'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getSettings()).rejects.toThrow('Connection lost');
    // Once from getDb() catch, once from the function itself
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});
