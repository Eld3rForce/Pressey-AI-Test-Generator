// ============================================================
// Settings Store — Svelte 5 runes-based reactive store
// ============================================================
// Uses $state rune (requires .svelte.ts extension) for deep
// reactivity. dbService is dynamically imported so this module
// can be loaded in non-DB contexts (tests, SSR) without failing.
// ============================================================

import type { Settings } from './types';

const defaults: Settings = {
  apiKey: '',
  model: 'openai/gpt-4o',
  defaultQuestionCount: 10,
  defaultMcqPercentage: 70,
  defaultDifficulty: 'Medium',
};

export const settingsStore = {
  settings: $state<Settings>({ ...defaults }),
  loaded: $state(false),
  error: $state<string | null>(null),

  async loadSettings() {
    try {
      const { getSettings } = await import('./dbService');
      const s = await getSettings();
      this.settings = { ...defaults, ...s };
      this.loaded = true;
    } catch {
      this.settings = { ...defaults };
      this.loaded = true;
    }
  },

  async saveSettings(s: Settings) {
    try {
      const { saveSetting } = await import('./dbService');
      const entries = Object.entries(s) as [string, string | number | undefined][];
      for (const [key, value] of entries) {
        if (value === undefined) continue;
        await saveSetting(key, String(value));
      }
      this.settings = { ...s };
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save settings';
      throw e;
    }
  },

  async updateSetting(key: string, value: string) {
    try {
      const { saveSetting } = await import('./dbService');
      await saveSetting(key, value);
      (this.settings as Record<string, unknown>)[key] = value;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to update setting';
    }
  },

  async testApiConnection(apiKey: string): Promise<boolean> {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  resetToDefaults() {
    this.settings = { ...defaults };
    this.error = null;
  },
};
