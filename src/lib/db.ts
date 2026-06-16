import Database from '@tauri-apps/plugin-sql';
import { appLocalDataDir, join } from '@tauri-apps/api/path';

let dbInstance: Database | null = null;

/**
 * Initialize the SQLite database. Loads the database file and runs migrations.
 * Returns a singleton Database instance — subsequent calls return the cached connection.
 */
export async function initDatabase(): Promise<Database> {
  try {
    if (dbInstance) {
      return dbInstance;
    }

    const appDir = await appLocalDataDir();
    const dbPath = await join(appDir, 'pressey.db');
    dbInstance = await Database.load(`sqlite:${dbPath}`);
    await runMigrations(dbInstance);
    return dbInstance;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    dbInstance = null;
    throw error;
  }
}

/**
 * Run schema migrations against the database.
 * Uses a schema_version table to track applied migrations.
 * All CREATE TABLE statements use IF NOT EXISTS for idempotency.
 */
export async function runMigrations(db: Database): Promise<void> {
  try {
    // ── schema_version tracking ──────────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Seed version row if none exists
    const countResult = await db.select<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM schema_version'
    );
    if (!countResult[0] || countResult[0].count === 0) {
      await db.execute('INSERT INTO schema_version (version) VALUES (0)');
    }

    // Read current version
    const versionResult = await db.select<{ version: number }[]>(
      'SELECT version FROM schema_version LIMIT 1'
    );
    const currentVersion = versionResult[0]?.version ?? 0;

    // ── Migration v1: core schema ────────────────────────────────────
    if (currentVersion < 1) {
      // 1. settings
      await db.execute(`
        CREATE TABLE IF NOT EXISTS settings (
          key   TEXT PRIMARY KEY,
          value TEXT
        )
      `);

      // 2. tests
      await db.execute(`
        CREATE TABLE IF NOT EXISTS tests (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          title           TEXT NOT NULL,
          topic           TEXT,
          difficulty      TEXT,
          question_count  INTEGER,
          mcq_percentage  INTEGER,
          created_at      TEXT DEFAULT (datetime('now')),
          updated_at      TEXT DEFAULT (datetime('now'))
        )
      `);

      // 3. questions
      await db.execute(`
        CREATE TABLE IF NOT EXISTS questions (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          test_id         INTEGER NOT NULL,
          type            TEXT NOT NULL CHECK(type IN ('mcq', 'text')),
          text            TEXT NOT NULL,
          options         TEXT,
          correct_answer  TEXT NOT NULL,
          explanation     TEXT,
          order_index     INTEGER NOT NULL,
          FOREIGN KEY(test_id) REFERENCES tests(id) ON DELETE CASCADE
        )
      `);

      // 4. attempts
      await db.execute(`
        CREATE TABLE IF NOT EXISTS attempts (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          test_id         INTEGER NOT NULL,
          started_at      TEXT DEFAULT (datetime('now')),
          completed_at    TEXT,
          score           REAL,
          total_questions INTEGER,
          FOREIGN KEY(test_id) REFERENCES tests(id) ON DELETE CASCADE
        )
      `);

      // 5. responses
      await db.execute(`
        CREATE TABLE IF NOT EXISTS responses (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          attempt_id      INTEGER NOT NULL,
          question_id     INTEGER NOT NULL,
          user_answer     TEXT,
          is_correct      INTEGER DEFAULT 0,
          FOREIGN KEY(attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
          FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
        )
      `);

      // Bump version
      await db.execute('UPDATE schema_version SET version = 1');
    }

    // ── Migration v2: explanations ───────────────────────────────────
    if (currentVersion < 2) {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS explanations (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          attempt_id      INTEGER NOT NULL,
          question_id     INTEGER NOT NULL,
          explanation     TEXT NOT NULL,
          user_mistake    TEXT NOT NULL,
          resources       TEXT NOT NULL,
          FOREIGN KEY(attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
          FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
        )
      `);

      await db.execute('UPDATE schema_version SET version = 2');
    }

    // Future migration versions go here:
    // if (currentVersion < 3) { ... }
  } catch (error) {
    console.error('Failed to run migrations:', error);
    throw error;
  }
}

/**
 * Reset the singleton for unit-test isolation.
 * NOT for production use.
 */
export function _resetForTest(): void {
  dbInstance = null;
}
