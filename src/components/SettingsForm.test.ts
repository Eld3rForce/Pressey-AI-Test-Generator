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
    personality: 'none',
    customInstructions: '',
    includeMcq: true,
    includeText: true,
    enableResearch: false,
    researchMaxResults: 5,
    researchMaxSnippetChars: 800,
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

// Helper to get the mutable settings mock
async function getMockSettings() {
  const mod = await import('../lib/settingsStore.svelte');
  return mod.settingsStore.settings as Record<string, unknown>;
}

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

  describe('research settings', () => {
    it('renders enableResearch checkbox', () => {
      render(SettingsForm);
      const checkbox = screen.getByTestId('enable-research-checkbox') as HTMLInputElement;
      expect(checkbox).toBeTruthy();
      expect(checkbox.type).toBe('checkbox');
    });

    it('enableResearch checkbox starts unchecked', () => {
      render(SettingsForm);
      const checkbox = screen.getByTestId('enable-research-checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('hides max results and snippet chars inputs when enableResearch is false', () => {
      render(SettingsForm);
      expect(screen.queryByTestId('research-max-results-input')).toBeNull();
      expect(screen.queryByTestId('research-max-snippet-chars-input')).toBeNull();
    });

    it('shows max results and snippet chars inputs when enableResearch is true', async () => {
      const s = await getMockSettings();
      s.enableResearch = true;
      render(SettingsForm);
      expect(await screen.findByTestId('research-max-results-input')).toBeTruthy();
      expect(await screen.findByTestId('research-max-snippet-chars-input')).toBeTruthy();
    });

    it('respects min/max on max results input', async () => {
      const s = await getMockSettings();
      s.enableResearch = true;
      render(SettingsForm);
      const input = (await screen.findByTestId('research-max-results-input')) as HTMLInputElement;
      expect(input.min).toBe('1');
      expect(input.max).toBe('10');
    });

    it('respects min/max on snippet chars input', async () => {
      const s = await getMockSettings();
      s.enableResearch = true;
      render(SettingsForm);
      const input = (await screen.findByTestId('research-max-snippet-chars-input')) as HTMLInputElement;
      expect(input.min).toBe('100');
      expect(input.max).toBe('2000');
    });

    it('saves research settings with correct values', async () => {
      const { settingsStore } = await import('../lib/settingsStore.svelte');
      const s = await getMockSettings();
      s.enableResearch = true;
      s.researchMaxResults = 8;
      s.researchMaxSnippetChars = 1200;
      s.openrouterKey = 'sk-or-v1-test-key';
      render(SettingsForm);
      // Flush microtasks so the $effect .then() from loadSettings runs
      await new Promise(resolve => setTimeout(resolve, 0));
      await fireEvent.click(screen.getByText('Save Settings'));
      expect(settingsStore.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          enableResearch: true,
          researchMaxResults: 8,
          researchMaxSnippetChars: 1200,
        }),
      );
    });
  });
});
