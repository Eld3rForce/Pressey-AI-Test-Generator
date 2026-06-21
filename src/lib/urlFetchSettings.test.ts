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

// ── URL Fetch defaults ─────────────────────────────────────────────

describe('urlFetchSettings defaults', () => {
  it('defaults enableUrlFetch to false (opt-in)', () => {
    expect(settingsStore.settings.enableUrlFetch).toBe(false);
  });

  it('defaults urlFetchMaxResults to 5', () => {
    expect(settingsStore.settings.urlFetchMaxResults).toBe(5);
  });

  it('defaults urlFetchMaxBytesPerUrl to 2_000_000', () => {
    expect(settingsStore.settings.urlFetchMaxBytesPerUrl).toBe(2_000_000);
  });
});

// ── Roundtrip ──────────────────────────────────────────────────────

describe('urlFetchSettings roundtrip', () => {
  it('roundtrips all three fields through saveSettings/loadSettings', async () => {
    settingsStore.settings.enableUrlFetch = true;
    settingsStore.settings.urlFetchMaxResults = 10;
    settingsStore.settings.urlFetchMaxBytesPerUrl = 5_000_000;

    await settingsStore.saveSettings({
      apiKey: '',
      model: 'openai/gpt-4o',
      defaultQuestionCount: 10,
      defaultMcqPercentage: 50,
      defaultDifficulty: 'Medium',
      enableUrlFetch: true,
      urlFetchMaxResults: 10,
      urlFetchMaxBytesPerUrl: 5_000_000,
    });

    // Verify they were persisted
    expect(mockSaveSetting).toHaveBeenCalledWith('enableUrlFetch', 'true');
    expect(mockSaveSetting).toHaveBeenCalledWith('urlFetchMaxResults', '10');
    expect(mockSaveSetting).toHaveBeenCalledWith('urlFetchMaxBytesPerUrl', '5000000');
  });
});
