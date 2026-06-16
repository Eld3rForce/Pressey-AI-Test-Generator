import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import SettingsForm from './SettingsForm.svelte';

// vi.mock path must match the .svelte import specifier used in SettingsForm.svelte
vi.mock('../lib/settingsStore.svelte', () => {
  const defaults = {
    apiKey: '',
    model: 'openai/gpt-4o',
    defaultQuestionCount: 10,
    defaultMcqPercentage: 70,
    defaultDifficulty: 'Medium',
    provider: 'openrouter',
    openaiKey: '',
    anthropicKey: '',
    geminiKey: '',
    ollamaUrl: 'http://localhost:11434',
    openrouterKey: '',
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
    expect(screen.getByText('openai/gpt-4o')).toBeTruthy();
    expect(screen.getByText('Test Connection')).toBeTruthy();
    expect(screen.getByText('Save Settings')).toBeTruthy();
  });

  it('API key input is password type', () => {
    render(SettingsForm);
    const input = screen.getByTestId('api-key-input') as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('renders provider dropdown with all options', () => {
    render(SettingsForm);
    const select = screen.getByTestId('provider-select') as HTMLSelectElement;
    expect(select.children.length).toBe(5);
    expect(select.textContent).toContain('OpenAI');
    expect(select.textContent).toContain('Anthropic');
    expect(select.textContent).toContain('Google Gemini');
    expect(select.textContent).toContain('Ollama');
    expect(select.textContent).toContain('OpenRouter');
  });

  it('has model dropdown for OpenRouter with correct options', () => {
    render(SettingsForm);
    const select = screen.getByTestId('model-input') as HTMLSelectElement;
    expect(select.children.length).toBe(3);
    expect(select.textContent).toContain('openai/gpt-4o');
    expect(select.textContent).toContain('google/gemini-1.5-pro');
  });

  it('model select defaults to first OpenRouter option', () => {
    render(SettingsForm);
    const modelSelect = screen.getByTestId('model-input') as HTMLSelectElement;
    expect(modelSelect.value).toBe('openai/gpt-4o');
  });

  it('model select renders as dropdown for OpenRouter', () => {
    render(SettingsForm);
    const modelEl = screen.getByTestId('model-input');
    expect(modelEl.tagName).toBe('SELECT');
  });

  it('test connection button has data-testid', () => {
    render(SettingsForm);
    expect(screen.getByTestId('test-connection-button')).toBeTruthy();
  });

  it('difficulty radio buttons exist', () => {
    render(SettingsForm);
    expect(screen.getByText('Easy')).toBeTruthy();
    expect(screen.getByText('Medium')).toBeTruthy();
    expect(screen.getByText('Hard')).toBeTruthy();
  });

  it('shows note about Anthropic routing through OpenRouter when provider is Anthropic', async () => {
    render(SettingsForm);
    const select = screen.getByTestId('provider-select') as HTMLSelectElement;
    select.value = 'anthropic';
    fireEvent.change(select);
    expect(screen.getByText(/routes through OpenRouter/)).toBeTruthy();
  });
});
