import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock dbService so dynamic imports resolve to our mocks ──
const { mockGetSettings, mockSaveSetting } = vi.hoisted(() => ({
  mockGetSettings: vi.fn(),
  mockSaveSetting: vi.fn(),
}));

vi.mock('./dbService', () => ({
  getSettings: mockGetSettings,
  saveSetting: mockSaveSetting,
}));

import { settingsStore } from './settingsStore.svelte';

beforeEach(() => {
  settingsStore.resetToDefaults();
  settingsStore.loaded = false;
  settingsStore.error = null;
  vi.clearAllMocks();
  mockGetSettings.mockResolvedValue({
    apiKey: '',
    model: 'openai/gpt-4o',
    defaultQuestionCount: 10,
    defaultMcqPercentage: 70,
    defaultDifficulty: 'Medium',
    personality: undefined,
    customInstructions: undefined,
  });
  mockSaveSetting.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Defaults ──────────────────────────────────────────────────────

describe('defaults', () => {
  it('includes provider field defaulting to openrouter', () => {
    expect(settingsStore.settings.provider).toBe('openrouter');
  });

  it('includes all provider key fields as empty strings', () => {
    expect(settingsStore.settings.openaiKey).toBe('');
    expect(settingsStore.settings.anthropicKey).toBe('');
    expect(settingsStore.settings.geminiKey).toBe('');
    expect(settingsStore.settings.ollamaUrl).toBe('http://localhost:11434');
    expect(settingsStore.settings.openrouterKey).toBe('');
  });

  it('includes includeMcq and includeText defaulting to true', () => {
    expect(settingsStore.settings.includeMcq).toBe(true);
    expect(settingsStore.settings.includeText).toBe(true);
  });

  it('preserves existing defaults', () => {
    expect(settingsStore.settings.apiKey).toBe('');
    expect(settingsStore.settings.model).toBe('openai/gpt-4o');
    expect(settingsStore.settings.defaultQuestionCount).toBe(10);
    expect(settingsStore.settings.defaultDifficulty).toBe('Medium');
  });
});

// ── Migration: defaultMcqPercentage → toggles ─────────────────────

describe('migration: mcqPercentage to toggles', () => {
  it('migrates 70 → both ON and apiKey → openrouterKey', async () => {
    mockGetSettings.mockResolvedValue({
      apiKey: 'sk-legacy',
      defaultMcqPercentage: 70,
    });
    await settingsStore.loadSettings();
    expect(settingsStore.settings.includeMcq).toBe(true);
    expect(settingsStore.settings.includeText).toBe(true);
    expect(settingsStore.settings.openrouterKey).toBe('sk-legacy');
  });

  it('migrates 0 → MCQ off, text on', async () => {
    mockGetSettings.mockResolvedValue({
      defaultMcqPercentage: 0,
    });
    await settingsStore.loadSettings();
    expect(settingsStore.settings.includeMcq).toBe(false);
    expect(settingsStore.settings.includeText).toBe(true);
  });

  it('migrates 100 → MCQ on, text off', async () => {
    mockGetSettings.mockResolvedValue({
      defaultMcqPercentage: 100,
    });
    await settingsStore.loadSettings();
    expect(settingsStore.settings.includeMcq).toBe(true);
    expect(settingsStore.settings.includeText).toBe(false);
  });

  it('migrates 50 → both ON', async () => {
    mockGetSettings.mockResolvedValue({
      defaultMcqPercentage: 50,
    });
    await settingsStore.loadSettings();
    expect(settingsStore.settings.includeMcq).toBe(true);
    expect(settingsStore.settings.includeText).toBe(true);
  });
});

// ── Migration: idempotency ────────────────────────────────────────

describe('migration: idempotent', () => {
  it('does not re-migrate if includeMcq/includeText already set', async () => {
    mockGetSettings.mockResolvedValue({
      defaultMcqPercentage: 0,
      includeMcq: true,
      includeText: false,
    });
    await settingsStore.loadSettings();
    // Should preserve explicit values, not re-migrate from 0
    expect(settingsStore.settings.includeMcq).toBe(true);
    expect(settingsStore.settings.includeText).toBe(false);
  });

  it('does not overwrite openrouterKey if already set', async () => {
    mockGetSettings.mockResolvedValue({
      apiKey: 'sk-legacy',
      openrouterKey: 'sk-existing',
    });
    await settingsStore.loadSettings();
    expect(settingsStore.settings.openrouterKey).toBe('sk-existing');
  });

  it('running loadSettings twice is safe', async () => {
    mockGetSettings.mockResolvedValue({
      defaultMcqPercentage: 70,
    });
    await settingsStore.loadSettings();
    expect(settingsStore.settings.includeMcq).toBe(true);

    await settingsStore.loadSettings();
    expect(settingsStore.settings.includeMcq).toBe(true);
    expect(settingsStore.settings.includeText).toBe(true);
  });
});

// ── Theme / accent preservation ───────────────────────────────────

describe('theme/accent preservation', () => {
  it('saveSettings does not persist theme or accent keys', async () => {
    await settingsStore.updateSetting('theme', 'dark');
    await settingsStore.updateSetting('accent', 'cyan');
    mockSaveSetting.mockClear();

    await settingsStore.saveSettings({
      apiKey: 'new-key',
      model: 'gpt-4o',
      defaultQuestionCount: 10,
      defaultMcqPercentage: 50,
      defaultDifficulty: 'Medium',
    });

    const savedKeys = mockSaveSetting.mock.calls.map((c: unknown[]) => c[0]);
    expect(savedKeys).not.toContain('theme');
    expect(savedKeys).not.toContain('accent');
    expect(savedKeys).toContain('apiKey');
  });

  it('preserves theme/accent in-memory after saveSettings', async () => {
    await settingsStore.updateSetting('theme', 'dark');
    await settingsStore.updateSetting('accent', 'cyan');

    await settingsStore.saveSettings({
      apiKey: 'new-key',
      model: 'gpt-4o',
      defaultQuestionCount: 10,
      defaultMcqPercentage: 50,
      defaultDifficulty: 'Medium',
    });

    const raw = settingsStore.settings as unknown as Record<string, unknown>;
    expect(raw.theme).toBe('dark');
    expect(raw.accent).toBe('cyan');
  });
});

// ── testApiConnection ─────────────────────────────────────────────

describe('testApiConnection', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns false when no key is available', async () => {
    settingsStore.settings.provider = 'openrouter';
    settingsStore.settings.openrouterKey = '';
    await expect(settingsStore.testApiConnection()).resolves.toBe(false);
  });

  it('tests OpenRouter with provided apiKey arg', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const result = await settingsStore.testApiConnection('sk-test-key');
    expect(result).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/auth/key',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer sk-test-key' }) }),
    );
  });

  it('tests OpenRouter with store key when called without args', async () => {
    settingsStore.settings.provider = 'openrouter';
    settingsStore.settings.openrouterKey = 'sk-store-key';
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    const result = await settingsStore.testApiConnection();
    expect(result).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/auth/key',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer sk-store-key' }) }),
    );
  });

  it('tests Ollama connection', async () => {
    settingsStore.settings.provider = 'ollama';
    settingsStore.settings.ollamaUrl = 'http://localhost:11434';
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    const result = await settingsStore.testApiConnection();
    expect(result).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
    );
  });

  it('returns false on fetch failure', async () => {
    settingsStore.settings.provider = 'openrouter';
    settingsStore.settings.openrouterKey = 'sk-key';
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('timeout'));

    await expect(settingsStore.testApiConnection()).resolves.toBe(false);
  });
});

// ── Error handling ────────────────────────────────────────────────

describe('error handling', () => {
  it('sets loaded=true even on loadSettings failure', async () => {
    mockGetSettings.mockRejectedValue(new Error('db error'));
    await settingsStore.loadSettings();
    expect(settingsStore.loaded).toBe(true);
    expect(settingsStore.settings.apiKey).toBe('');
  });

  it('saveSettings sets error and rethrows', async () => {
    mockSaveSetting.mockRejectedValue(new Error('save failed'));
    await expect(
      settingsStore.saveSettings({
        apiKey: 'x',
        model: 'gpt-4o',
        defaultQuestionCount: 10,
        defaultMcqPercentage: 50,
        defaultDifficulty: 'Medium',
      }),
    ).rejects.toThrow('save failed');
    expect(settingsStore.error).toBe('save failed');
  });
});

// ── updateSetting ─────────────────────────────────────────────────

describe('updateSetting', () => {
  it('persists and updates in-memory state', async () => {
    await settingsStore.updateSetting('theme', 'dark');
    expect(mockSaveSetting).toHaveBeenCalledWith('theme', 'dark');
    const raw = settingsStore.settings as unknown as Record<string, unknown>;
    expect(raw.theme).toBe('dark');
  });
});
