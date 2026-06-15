import type Database from '@tauri-apps/plugin-sql';
import { initDatabase } from './db';
import type { Test, Question, Attempt, Response, Settings, Explanation, LearningResource } from './types';
import { createApiError, ErrorCodes } from './errorUtils';

// ── Internal helpers ──────────────────────────────────────────────────

interface TestRow {
  id: number;
  title: string;
  topic: string | null;
  difficulty: string | null;
  question_count: number;
  mcq_percentage: number;
  created_at: string;
  updated_at: string;
}

interface TestListRow extends TestRow {
  live_question_count: number;
}

interface QuestionRow {
  id: number;
  test_id: number;
  type: 'mcq' | 'text';
  text: string;
  options: string | null;
  correct_answer: string;
  explanation: string | null;
  order_index: number;
}

interface AttemptRow {
  id: number;
  test_id: number;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  total_questions: number | null;
}

interface ResponseRow {
  id: number;
  attempt_id: number;
  question_id: number;
  user_answer: string | null;
  is_correct: number;
}

interface SettingRow {
  key: string;
  value: string;
}

interface ExplanationRow {
  id: number;
  attempt_id: number;
  question_id: number;
  explanation: string;
  user_mistake: string;
  resources: string;
}

function mapQuestion(row: QuestionRow): Question {
  let options: string[] = [];
  if (row.options) {
    try {
      options = JSON.parse(row.options);
    } catch {
      options = [];
    }
  }
  return {
    id: row.id,
    testId: row.test_id,
    type: row.type,
    text: row.text,
    options,
    correctAnswer: row.correct_answer,
    explanation: row.explanation ?? undefined,
    orderIndex: row.order_index,
  };
}

function mapResponse(row: ResponseRow): Response {
  return {
    id: row.id,
    attemptId: row.attempt_id,
    questionId: row.question_id,
    userAnswer: row.user_answer ?? '',
    isCorrect: row.is_correct === 1,
  };
}

function mapExplanation(row: ExplanationRow): Explanation {
  let resources: LearningResource[] = [];
  if (row.resources) {
    try {
      resources = JSON.parse(row.resources);
    } catch (err) {
      console.error('mapExplanation: failed to parse resources JSON', err);
      resources = [];
    }
  }
  return {
    id: row.id,
    attemptId: row.attempt_id,
    questionId: row.question_id,
    explanation: row.explanation,
    userMistake: row.user_mistake,
    resources,
  };
}

/**
 * Wraps a database error into a typed ApiError.
 * Inspects the error message to classify connection/constraint/migration failures.
 */
function wrapDbError(error: unknown, operation: string): never {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    // Already an ApiError — rethrow as-is
    throw error;
  }

  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (
    lower.includes('connection') ||
    lower.includes('sqlite_busy') ||
    lower.includes('database is locked') ||
    lower.includes('cannot open')
  ) {
    throw createApiError(
      ErrorCodes.DB_CONNECTION_LOST,
      `Database connection lost during ${operation}: ${msg}`
    );
  }

  if (
    lower.includes('constraint') ||
    lower.includes('unique') ||
    lower.includes('foreign key')
  ) {
    throw createApiError(
      ErrorCodes.DB_CONSTRAINT_VIOLATION,
      `Database constraint violation during ${operation}: ${msg}`
    );
  }

  if (lower.includes('migration') || lower.includes('schema')) {
    throw createApiError(
      ErrorCodes.DB_MIGRATION_FAILURE,
      `Database migration failure during ${operation}: ${msg}`
    );
  }

  throw createApiError(
    ErrorCodes.DB_QUERY_ERROR,
    `Database error during ${operation}: ${msg}`
  );
}

async function getDb(): Promise<Database> {
  try {
    return await initDatabase();
  } catch (error) {
    console.error('Database service: failed to initialize database:', error);
    throw createApiError(
      ErrorCodes.DB_INIT_ERROR,
      `Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ── Test CRUD ─────────────────────────────────────────────────────────

/**
 * Create a new test with all its questions.
 * Inserts the test row first, then each question using the returned test ID.
 */
export async function createTest(test: Test): Promise<number> {
  const db = await getDb();
  try {
    const result = await db.execute(
      `INSERT INTO tests (title, topic, difficulty, question_count, mcq_percentage)
       VALUES (?, ?, ?, ?, ?)`,
      [test.title, test.topic ?? null, test.difficulty, test.questionCount, test.mcqPercentage]
    );

    const testId = result.lastInsertId!;

    for (const question of test.questions) {
      const optionsJson = JSON.stringify(question.options ?? []);
      await db.execute(
        `INSERT INTO questions (test_id, type, text, options, correct_answer, explanation, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          testId,
          question.type,
          question.text,
          optionsJson,
          question.correctAnswer,
          question.explanation ?? null,
          question.orderIndex,
        ]
      );
    }

    return testId;
  } catch (error) {
    console.error('createTest failed:', error);
    wrapDbError(error, 'createTest');
  }
}

/**
 * Fetch a single test with its questions joined.
 */
export async function getTest(id: number): Promise<Test | null> {
  const db = await getDb();
  try {
    const testRows = await db.select<TestRow[]>(
      `SELECT * FROM tests WHERE id = ?`,
      [id]
    );

    if (testRows.length === 0) {
      return null;
    }

    const t = testRows[0];

    const questionRows = await db.select<QuestionRow[]>(
      `SELECT * FROM questions WHERE test_id = ? ORDER BY order_index`,
      [id]
    );

    return {
      id: t.id,
      title: t.title,
      topic: t.topic ?? undefined,
      difficulty: t.difficulty ?? '',
      questionCount: t.question_count,
      mcqPercentage: t.mcq_percentage,
      questions: questionRows.map(mapQuestion),
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    };
  } catch (error) {
    console.error('getTest failed:', error);
    wrapDbError(error, 'getTest');
  }
}

/**
 * List all tests with live question counts (from joined questions table).
 */
export async function getAllTests(): Promise<Test[]> {
  const db = await getDb();
  try {
    const rows = await db.select<TestListRow[]>(
      `SELECT t.*, COUNT(q.id) AS live_question_count
       FROM tests t
       LEFT JOIN questions q ON t.id = q.test_id
       GROUP BY t.id
       ORDER BY t.created_at DESC`
    );

    return rows.map((t) => ({
      id: t.id,
      title: t.title,
      topic: t.topic ?? undefined,
      difficulty: t.difficulty ?? '',
      questionCount: t.live_question_count,
      mcqPercentage: t.mcq_percentage,
      questions: [],
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));
  } catch (error) {
    console.error('getAllTests failed:', error);
    wrapDbError(error, 'getAllTests');
  }
}

/**
 * Delete a test and all related rows via ON DELETE CASCADE.
 */
export async function deleteTest(id: number): Promise<void> {
  const db = await getDb();
  try {
    await db.execute('DELETE FROM tests WHERE id = ?', [id]);
  } catch (error) {
    console.error('deleteTest failed:', error);
    wrapDbError(error, 'deleteTest');
  }
}

// ── Attempt CRUD ──────────────────────────────────────────────────────

/**
 * Create a new attempt for a given test. started_at is auto-set by the schema.
 */
export async function createAttempt(testId: number): Promise<number> {
  const db = await getDb();
  try {
    const result = await db.execute(
      `INSERT INTO attempts (test_id) VALUES (?)`,
      [testId]
    );
    return result.lastInsertId!;
  } catch (error) {
    console.error('createAttempt failed:', error);
    wrapDbError(error, 'createAttempt');
  }
}

/**
 * Mark an attempt as completed with a final score.
 */
export async function completeAttempt(
  id: number,
  score: number,
  totalQuestions: number
): Promise<void> {
  const db = await getDb();
  try {
    await db.execute(
      `UPDATE attempts
       SET completed_at = datetime('now'),
           score = ?,
           total_questions = ?
       WHERE id = ?`,
      [score, totalQuestions, id]
    );
  } catch (error) {
    console.error('completeAttempt failed:', error);
    wrapDbError(error, 'completeAttempt');
  }
}

/**
 * List all attempts for a given test, newest first.
 */
export async function getAttempts(testId: number): Promise<Attempt[]> {
  const db = await getDb();
  try {
    const rows = await db.select<AttemptRow[]>(
      `SELECT * FROM attempts WHERE test_id = ? ORDER BY started_at DESC`,
      [testId]
    );

    return rows.map((a) => ({
      id: a.id,
      testId: a.test_id,
      startedAt: a.started_at,
      completedAt: a.completed_at ?? undefined,
      score: a.score ?? undefined,
      totalQuestions: a.total_questions ?? undefined,
    }));
  } catch (error) {
    console.error('getAttempts failed:', error);
    wrapDbError(error, 'getAttempts');
  }
}

/**
 * Fetch a single attempt by id.
 */
export async function getAttempt(id: number): Promise<Attempt | null> {
  const db = await getDb();
  try {
    const rows = await db.select<AttemptRow[]>(
      `SELECT * FROM attempts WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    const a = rows[0];
    return {
      id: a.id,
      testId: a.test_id,
      startedAt: a.started_at,
      completedAt: a.completed_at ?? undefined,
      score: a.score ?? undefined,
      totalQuestions: a.total_questions ?? undefined,
    };
  } catch (error) {
    console.error('getAttempt failed:', error);
    wrapDbError(error, 'getAttempt');
  }
}

// ── Response CRUD ─────────────────────────────────────────────────────

/**
 * Save a single response. is_correct is converted from boolean to integer.
 */
export async function saveResponse(response: Response): Promise<void> {
  const db = await getDb();
  try {
    await db.execute(
      `INSERT INTO responses (attempt_id, question_id, user_answer, is_correct)
       VALUES (?, ?, ?, ?)`,
      [response.attemptId, response.questionId, response.userAnswer, response.isCorrect ? 1 : 0]
    );
  } catch (error) {
    console.error('saveResponse failed:', error);
    wrapDbError(error, 'saveResponse');
  }
}

/**
 * Batch save responses using sequential inserts.
 */
export async function saveResponses(responses: Response[]): Promise<void> {
  const db = await getDb();
  try {
    for (const response of responses) {
      await db.execute(
        `INSERT INTO responses (attempt_id, question_id, user_answer, is_correct)
         VALUES (?, ?, ?, ?)`,
        [response.attemptId, response.questionId, response.userAnswer, response.isCorrect ? 1 : 0]
      );
    }
  } catch (error) {
    console.error('saveResponses failed:', error);
    wrapDbError(error, 'saveResponses');
  }
}

/**
 * Get all responses for a given attempt.
 */
export async function getResponses(attemptId: number): Promise<Response[]> {
  const db = await getDb();
  try {
    const rows = await db.select<ResponseRow[]>(
      `SELECT * FROM responses WHERE attempt_id = ?`,
      [attemptId]
    );

    return rows.map(mapResponse);
  } catch (error) {
    console.error('getResponses failed:', error);
    wrapDbError(error, 'getResponses');
  }
}

// ── Explanation CRUD ──────────────────────────────────────────────────

/**
 * Save a single explanation. resources is JSON-serialized.
 */
export async function saveExplanation(explanation: Explanation): Promise<void> {
  const db = await getDb();
  try {
    await db.execute(
      `INSERT INTO explanations (attempt_id, question_id, explanation, user_mistake, resources)
       VALUES (?, ?, ?, ?, ?)`,
      [
        explanation.attemptId,
        explanation.questionId,
        explanation.explanation,
        explanation.userMistake,
        JSON.stringify(explanation.resources),
      ]
    );
  } catch (error) {
    console.error('saveExplanation failed:', error);
    wrapDbError(error, 'saveExplanation');
  }
}

/**
 * Batch save explanations using sequential inserts.
 */
export async function saveExplanations(explanations: Explanation[]): Promise<void> {
  const db = await getDb();
  try {
    for (const explanation of explanations) {
      await db.execute(
        `INSERT INTO explanations (attempt_id, question_id, explanation, user_mistake, resources)
         VALUES (?, ?, ?, ?, ?)`,
        [
          explanation.attemptId,
          explanation.questionId,
          explanation.explanation,
          explanation.userMistake,
          JSON.stringify(explanation.resources),
        ]
      );
    }
  } catch (error) {
    console.error('saveExplanations failed:', error);
    wrapDbError(error, 'saveExplanations');
  }
}

/**
 * Get all explanations for a given attempt. resources JSON is deserialized back to LearningResource[].
 */
export async function getExplanations(attemptId: number): Promise<Explanation[]> {
  const db = await getDb();
  try {
    const rows = await db.select<ExplanationRow[]>(
      `SELECT * FROM explanations WHERE attempt_id = ?`,
      [attemptId]
    );

    return rows.map(mapExplanation);
  } catch (error) {
    console.error('getExplanations failed:', error);
    wrapDbError(error, 'getExplanations');
  }
}

// ── Settings CRUD ─────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'openai/gpt-4o',
  defaultQuestionCount: 10,
  defaultMcqPercentage: 50,
  defaultDifficulty: 'Medium',
};

/**
 * Load all settings as a typed Settings object with sensible defaults.
 */
export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  try {
    const rows = await db.select<SettingRow[]>('SELECT key, value FROM settings');

    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.key, row.value);
    }

    return {
      apiKey: map.get('apiKey') ?? DEFAULT_SETTINGS.apiKey,
      model: map.get('model') ?? DEFAULT_SETTINGS.model,
      defaultQuestionCount: map.has('defaultQuestionCount')
        ? parseInt(map.get('defaultQuestionCount')!, 10)
        : DEFAULT_SETTINGS.defaultQuestionCount,
      defaultMcqPercentage: map.has('defaultMcqPercentage')
        ? parseInt(map.get('defaultMcqPercentage')!, 10)
        : DEFAULT_SETTINGS.defaultMcqPercentage,
      defaultDifficulty: (map.get('defaultDifficulty') as Settings['defaultDifficulty']) ??
        DEFAULT_SETTINGS.defaultDifficulty,
      personality: map.get('personality') ?? undefined,
      customInstructions: map.get('customInstructions') ?? undefined,
    };
  } catch (error) {
    console.error('getSettings failed:', error);
    wrapDbError(error, 'getSettings');
  }
}

/**
 * Upsert a single setting key-value pair.
 */
export async function saveSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  try {
    await db.execute(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      [key, value]
    );
  } catch (error) {
    console.error('saveSetting failed:', error);
    wrapDbError(error, 'saveSetting');
  }
}

/**
 * Delete a setting by key.
 */
export async function deleteSetting(key: string): Promise<void> {
  const db = await getDb();
  try {
    await db.execute('DELETE FROM settings WHERE key = ?', [key]);
  } catch (error) {
    console.error('deleteSetting failed:', error);
    wrapDbError(error, 'deleteSetting');
  }
}
