import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared mock state (vi.hoisted to work with hoisted vi.mock) ──────
const { mockExecute, mockSelect, mockLoad } = vi.hoisted(() => ({
  mockExecute: vi.fn().mockResolvedValue({ rowsAffected: 1, lastInsertId: 1 }),
  mockSelect: vi.fn().mockResolvedValue([]),
  mockLoad: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: Object.assign(vi.fn(), { load: mockLoad }),
}));

vi.mock('@tauri-apps/api/path', () => ({
  appLocalDataDir: () => Promise.resolve('/fake/app/dir'),
  join: (...segments: string[]) => Promise.resolve(segments.join('/')),
}));

import type Database from '@tauri-apps/plugin-sql';
import { initDatabase, runMigrations, _resetForTest } from './db';

// ── Helpers ──────────────────────────────────────────────────────────
function executedSqls(): string[] {
  return mockExecute.mock.calls.map((call: unknown[]) => call[0] as string);
}

// ── initDatabase ─────────────────────────────────────────────────────
describe('initDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetForTest();
    mockLoad.mockResolvedValue({ execute: mockExecute, select: mockSelect });
    // Default migration flow: empty schema_version table, version 0
    mockSelect
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ version: 0 }]);
  });

  it('loads the database with the correct SQLite path', async () => {
    await initDatabase();
    expect(mockLoad).toHaveBeenCalledWith('sqlite:/fake/app/dir/pressey.db');
  });

  it('creates all 7 tables (schema_version + 6 app tables) on fresh install', async () => {
    await initDatabase();

    const sqls = executedSqls();
    expect(sqls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS schema_version'))).toBe(true);
    expect(sqls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS settings'))).toBe(true);
    expect(sqls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS tests'))).toBe(true);
    expect(sqls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS questions'))).toBe(true);
    expect(sqls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS attempts'))).toBe(true);
    expect(sqls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS responses'))).toBe(true);
    expect(sqls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS explanations'))).toBe(true);
    expect(sqls.some((s) => s.includes('UPDATE schema_version SET version = 3'))).toBe(true);
  });

  it('returns the cached singleton on repeat calls', async () => {
    const db1 = await initDatabase();
    const db2 = await initDatabase();

    expect(db1).toBe(db2);
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it('handles Database.load connection errors', async () => {
    mockLoad.mockRejectedValueOnce(new Error('Connection failed'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(initDatabase()).rejects.toThrow('Connection failed');
    expect(spy).toHaveBeenCalled();

    // After a failed init the singleton should be cleared,
    // so a retry calls load again
    mockLoad.mockResolvedValueOnce({ execute: mockExecute, select: mockSelect });
    mockSelect
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ version: 0 }]);

    await initDatabase();
    expect(mockLoad).toHaveBeenCalledTimes(2);

    spy.mockRestore();
  });

  it('handles migration errors gracefully', async () => {
    // First execute call (CREATE schema_version) succeeds, second fails
    mockExecute
      .mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 1 })
      .mockRejectedValueOnce(new Error('SQL syntax error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(initDatabase()).rejects.toThrow('SQL syntax error');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

// ── runMigrations ────────────────────────────────────────────────────
describe('runMigrations', () => {
  let mockExec: ReturnType<typeof vi.fn>;
  let mockSel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockExec = vi.fn().mockResolvedValue({ rowsAffected: 1, lastInsertId: 1 });
    mockSel = vi.fn().mockResolvedValue([]);
  });

  it('seeds the schema_version row when the table is empty', async () => {
    mockSel
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ version: 0 }]);

    const db = { execute: mockExec, select: mockSel } as unknown as Database;
    await runMigrations(db);

    const sqls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(sqls.some((s) => s.includes('INSERT INTO schema_version'))).toBe(true);
  });

  it('skips the seed when schema_version already has a row', async () => {
    mockSel
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ version: 0 }]);

    const db = { execute: mockExec, select: mockSel } as unknown as Database;
    await runMigrations(db);

    const sqls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(sqls.some((s) => s.includes('INSERT INTO schema_version'))).toBe(false);
  });

  it('creates all 6 application tables', async () => {
    mockSel
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ version: 0 }]);

    const db = { execute: mockExec, select: mockSel } as unknown as Database;
    await runMigrations(db);

    const sqls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(sqls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS settings'))).toBe(true);
    expect(sqls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS tests'))).toBe(true);
    expect(sqls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS questions'))).toBe(true);
    expect(sqls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS attempts'))).toBe(true);
    expect(sqls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS responses'))).toBe(true);
    expect(sqls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS explanations'))).toBe(true);
    expect(sqls.some((s) => s.includes('UPDATE schema_version SET version = 3'))).toBe(true);
  });

  it('skips app table creation when version is already >= 1', async () => {
    mockSel
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ version: 3 }]);

    const db = { execute: mockExec, select: mockSel } as unknown as Database;
    await runMigrations(db);

    const sqls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
    const createTableSqls = sqls.filter((s) => s.includes('CREATE TABLE'));
    expect(createTableSqls).toHaveLength(1);
  });

  it('handles migration errors gracefully', async () => {
    mockSel
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ version: 0 }]);
    mockExec.mockRejectedValueOnce(new Error('Disk full'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const db = { execute: mockExec, select: mockSel } as unknown as Database;
    await expect(runMigrations(db)).rejects.toThrow('Disk full');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });

  it('v3 migration adds current_index column to attempts', async () => {
    mockSel
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ version: 0 }]);

    const db = { execute: mockExec, select: mockSel } as unknown as Database;
    await runMigrations(db);

    const sqls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
    const alterSql = sqls.find((s) => s.includes('ALTER TABLE attempts'));
    expect(alterSql).toBeDefined();
    expect(alterSql).toMatch(/ADD\s+COLUMN\s+current_index/i);
    expect(alterSql).toMatch(/INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0/i);
    expect(sqls).toContain('UPDATE schema_version SET version = 3');
  });

  it('existing attempts have current_index = 0 after v3 migration', async () => {
    mockSel
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ version: 2 }]);

    const db = { execute: mockExec, select: mockSel } as unknown as Database;
    await runMigrations(db);

    const sqls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
    const alterSql = sqls.find((s) => s.includes('ALTER TABLE attempts'));
    expect(alterSql).toBeDefined();
    expect(alterSql).toMatch(/DEFAULT\s+0/i);
    expect(sqls).toContain('UPDATE schema_version SET version = 3');
  });
});

// ── Schema constraints (column & FK validation) ──────────────────────
describe('Schema constraints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupRun(): Database {
    mockSelect
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ version: 0 }]);
    return { execute: mockExecute, select: mockSelect } as unknown as Database;
  }

  it('tests table has all required columns', async () => {
    await runMigrations(setupRun());

    const testsSql = executedSqls().find((s) => s.includes('CREATE TABLE IF NOT EXISTS tests'));
    expect(testsSql).toBeDefined();
    expect(testsSql).toMatch(/id\s+INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/i);
    expect(testsSql).toMatch(/title\s+TEXT\s+NOT\s+NULL/i);
    expect(testsSql).toMatch(/topic\s+TEXT/i);
    expect(testsSql).toMatch(/difficulty\s+TEXT/i);
    expect(testsSql).toMatch(/question_count\s+INTEGER/i);
    expect(testsSql).toMatch(/mcq_percentage\s+INTEGER/i);
    expect(testsSql).toMatch(/created_at\s+TEXT/i);
    expect(testsSql).toMatch(/updated_at\s+TEXT/i);
  });

  it('questions table has CHECK constraint and FK with ON DELETE CASCADE', async () => {
    await runMigrations(setupRun());

    const questionsSql = executedSqls().find((s) =>
      s.includes('CREATE TABLE IF NOT EXISTS questions')
    );
    expect(questionsSql).toBeDefined();
    expect(questionsSql).toMatch(
      /FOREIGN\s+KEY\s*\(\s*test_id\s*\)\s*REFERENCES\s+tests\s*\(\s*id\s*\)\s*ON\s+DELETE\s+CASCADE/i
    );
    expect(questionsSql).toMatch(
      /type\s+TEXT\s+NOT\s+NULL\s+CHECK\s*\(\s*type\s+IN\s*\(\s*'mcq'\s*,\s*'text'\s*\)\s*\)/i
    );
    expect(questionsSql).toMatch(/order_index\s+INTEGER\s+NOT\s+NULL/i);
  });

  it('responses table has two FKs with ON DELETE CASCADE', async () => {
    await runMigrations(setupRun());

    const responsesSql = executedSqls().find((s) =>
      s.includes('CREATE TABLE IF NOT EXISTS responses')
    );
    expect(responsesSql).toBeDefined();
    expect(responsesSql).toMatch(
      /FOREIGN\s+KEY\s*\(\s*attempt_id\s*\)\s*REFERENCES\s+attempts\s*\(\s*id\s*\)\s*ON\s+DELETE\s+CASCADE/i
    );
    expect(responsesSql).toMatch(
      /FOREIGN\s+KEY\s*\(\s*question_id\s*\)\s*REFERENCES\s+questions\s*\(\s*id\s*\)\s*ON\s+DELETE\s+CASCADE/i
    );
    expect(responsesSql).toMatch(/is_correct\s+INTEGER\s+DEFAULT\s+0/i);
  });

  it('attempts table has FK with ON DELETE CASCADE', async () => {
    await runMigrations(setupRun());

    const attemptsSql = executedSqls().find((s) =>
      s.includes('CREATE TABLE IF NOT EXISTS attempts')
    );
    expect(attemptsSql).toBeDefined();
    expect(attemptsSql).toMatch(
      /FOREIGN\s+KEY\s*\(\s*test_id\s*\)\s*REFERENCES\s+tests\s*\(\s*id\s*\)\s*ON\s+DELETE\s+CASCADE/i
    );
    expect(attemptsSql).toMatch(/started_at\s+TEXT/i);
    expect(attemptsSql).toMatch(/completed_at\s+TEXT/i);
    expect(attemptsSql).toMatch(/score\s+REAL/i);
    expect(attemptsSql).toMatch(/total_questions\s+INTEGER/i);
  });

  it('settings table has key as PRIMARY KEY', async () => {
    await runMigrations(setupRun());

    const settingsSql = executedSqls().find((s) =>
      s.includes('CREATE TABLE IF NOT EXISTS settings')
    );
    expect(settingsSql).toBeDefined();
    expect(settingsSql).toMatch(/key\s+TEXT\s+PRIMARY\s+KEY/i);
    expect(settingsSql).toMatch(/value\s+TEXT/i);
  });
});
