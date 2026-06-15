import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SettingsForm from './SettingsForm.svelte';

// vi.mock path must match the .svelte import specifier used in SettingsForm.svelte
vi.mock('../lib/settingsStore.svelte', () => {
  const defaults = {
    apiKey: '',
    model: 'openai/gpt-4o',
    defaultQuestionCount: 10,
    defaultMcqPercentage: 70,
    defaultDifficulty: 'Medium',
  };
  return {
    settingsStore: {
      settings: { ...defaults },
      loaded: false,
      error: null,
      loadSettings: vi.fn().mockResolvedValue(undefined),
      saveSettings: vi.fn().mockResolvedValue(undefined),
      updateSetting: vi.fn().mockResolvedValue(undefined),
      testApiConnection: vi.fn().mockResolvedValue(true),
      resetToDefaults: vi.fn(),
    },
  };
});

describe('SettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields', () => {
    render(SettingsForm);
    expect(screen.getByPlaceholderText('sk-or-...')).toBeTruthy();
    expect(screen.getByText('GPT-4o')).toBeTruthy();
    expect(screen.getByText('Test Connection')).toBeTruthy();
    expect(screen.getByText('Save Settings')).toBeTruthy();
  });

  it('API key input is password type', () => {
    render(SettingsForm);
    const input = screen.getByPlaceholderText('sk-or-...') as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('has all model options', () => {
    render(SettingsForm);
    const select = document.querySelector('select') as HTMLSelectElement;
    expect(select.children.length).toBe(4);
    expect(select.textContent).toContain('GPT-4o');
    expect(select.textContent).toContain('Gemini Pro');
  });

  it('difficulty radio buttons exist', () => {
    render(SettingsForm);
    expect(screen.getByText('Easy')).toBeTruthy();
    expect(screen.getByText('Medium')).toBeTruthy();
    expect(screen.getByText('Hard')).toBeTruthy();
  });
});
