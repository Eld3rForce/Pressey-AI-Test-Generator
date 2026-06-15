// ============================================================
// Settings Store — Svelte 5 runes-based reactive store
// ============================================================
// Uses $state rune (requires .svelte.ts extension) for deep
// reactivity. dbService is dynamically imported so this module
// can be loaded in non-DB contexts (tests, SSR) without failing.
// ============================================================

import type { Settings, ProviderType } from './types';
import { getProviderKey } from './providers/registry';

const defaults: Settings = {
  apiKey: '',
  model: 'openai/gpt-4o',
  defaultQuestionCount: 10,
  defaultMcqPercentage: 70,
  defaultDifficulty: 'Medium',
  personality: 'none',
  customInstructions: '',
  provider: 'openrouter',
  openaiKey: '',
  anthropicKey: '',
  geminiKey: '',
  ollamaUrl: 'http://localhost:11434',
  openrouterKey: '',
  includeMcq: true,
  includeText: true,
};

class SettingsStore {
  settings = $state<Settings>({ ...defaults });
  loaded = $state(false);
  error = $state<string | null>(null);

  async loadSettings() {
    try {
      const { getSettings } = await import('./dbService');
      const s = await getSettings();

      if (s.includeMcq === undefined || s.includeText === undefined) {
        const pct = s.defaultMcqPercentage ?? 70;
        if (pct === 0) {
          s.includeMcq = false;
          s.includeText = true;
        } else if (pct === 100) {
          s.includeMcq = true;
          s.includeText = false;
        } else {
          s.includeMcq = true;
          s.includeText = true;
        }
      }

      if (s.apiKey && !s.openrouterKey) {
        s.openrouterKey = s.apiKey;
      }

      this.settings = { ...defaults, ...s };
      this.loaded = true;
    } catch {
      this.settings = { ...defaults };
      this.loaded = true;
    }
  }

  async saveSettings(s: Settings) {
    try {
      const previous = this.settings;
      const { saveSetting } = await import('./dbService');
      const entries = Object.entries(s) as [string, string | number | boolean | undefined][];
      for (const [key, value] of entries) {
        if (value === undefined) continue;
        if (key === 'theme' || key === 'accent') continue;
        await saveSetting(key, String(value));
      }
      this.settings = { ...s } as Settings;
      const prevRaw = previous as unknown as Record<string, unknown>;
      const updated = this.settings as unknown as Record<string, unknown>;
      if (prevRaw.theme !== undefined) updated.theme = prevRaw.theme;
      if (prevRaw.accent !== undefined) updated.accent = prevRaw.accent;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save settings';
      throw e;
    }
  }

  async updateSetting(key: string, value: string) {
    try {
      const { saveSetting } = await import('./dbService');
      await saveSetting(key, value);
      (this.settings as unknown as Record<string, unknown>)[key] = value;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to update setting';
    }
  }

  /**
   * Test the API connection for the current (or specified) provider.
   *
   * Accepts an optional API key for backward compatibility with
   * SettingsForm.svelte which passes the key directly. When called
   * without arguments, reads the key from the store for the active
   * provider.
   */
  async testApiConnection(apiKey?: string): Promise<boolean> {
    const provider = (this.settings.provider || 'openrouter') as ProviderType;
    const key = apiKey || getProviderKey(this.settings, provider);
    if (!key) return false;

    try {
      switch (provider) {
        case 'ollama': {
          const baseUrl = key.replace(/\/+$/, '');
          const res = await fetch(`${baseUrl}/api/tags`);
          return res.ok;
        }
        case 'openrouter':
        case 'anthropic': {
          const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
            headers: { Authorization: `Bearer ${key}` },
          });
          return res.ok;
        }
        case 'openai': {
          const res = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${key}` },
          });
          return res.ok;
        }
        case 'gemini': {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
          );
          return res.ok;
        }
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  resetToDefaults() {
    this.settings = { ...defaults };
    this.error = null;
  }
}

export const settingsStore = new SettingsStore();
