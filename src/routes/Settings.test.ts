import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import Settings from './Settings.svelte';

// ── Mock settingsStore ────────────────────────────────────────────────
// The import specifier in Settings.svelte is "../lib/settingsStore.svelte"
// (explicit extension) — the mock path must match exactly.
vi.mock('../lib/settingsStore.svelte', () => {
  const defaults = {
    apiKey: '',
    model: 'openai/gpt-4o',
    defaultQuestionCount: 10,
    defaultMcqPercentage: 70,
    defaultDifficulty: 'Medium' as const,
    provider: 'openrouter' as const,
    includeMcq: true,
    includeText: true,
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

// Pull the mocked module so tests can assert on its methods.
import { settingsStore } from '../lib/settingsStore.svelte';

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Page header ────────────────────────────────────────────────
  it('renders the page header', () => {
    render(Settings);
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy();
    expect(screen.getByText('Configure')).toBeTruthy();
  });

  // ── 2. Four section landmarks ─────────────────────────────────────
  it('renders all four sections', () => {
    render(Settings);

    expect(screen.getByTestId('section-api')).toBeTruthy();
    expect(screen.getByTestId('section-preferences')).toBeTruthy();
    expect(screen.getByTestId('section-appearance')).toBeTruthy();
    expect(screen.getByTestId('section-about')).toBeTruthy();

    expect(screen.getByRole('heading', { level: 2, name: 'API Settings' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Default Preferences' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Appearance' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'About' })).toBeTruthy();
  });

  // ── 3. SettingsForm is mounted inside the API section ─────────────
  it('mounts SettingsForm inside the API section', () => {
    render(Settings);
    const apiSection = screen.getByTestId('section-api');
    expect(within(apiSection).getByPlaceholderText('sk-or-...')).toBeTruthy();
    expect(within(apiSection).getByText('Test Connection')).toBeTruthy();
    expect(within(apiSection).getByText('Save Settings')).toBeTruthy();
  });

  // ── 4. About section shows app metadata ───────────────────────────
  it('renders About metadata fields', () => {
    render(Settings);
    const about = screen.getByTestId('section-about');
    expect(within(about).getByText('v0.2.2')).toBeTruthy();
    expect(within(about).getByText('Local · SQLite')).toBeTruthy();
    expect(within(about).getByText('openrouter')).toBeTruthy();
    expect(within(about).getByText('Tauri v2')).toBeTruthy();
  });

  // ── 5. About provider displays active provider from store ─────────
  it('renders the active provider from settingsStore', () => {
    // Set a non-default provider before render to prove the About
    // section reads from the store rather than hardcoding a value.
    settingsStore.settings.provider = 'anthropic';
    render(Settings);
    const about = screen.getByTestId('section-about');
    expect(within(about).getByText('anthropic')).toBeTruthy();
  });

  // ── 6. Toggle switches are rendered in Default Preferences ───────
  it('renders includeMcq and includeText toggles', () => {
    render(Settings);
    const prefs = screen.getByTestId('section-preferences');
    expect(within(prefs).getByTestId('include-mcq-toggle')).toBeTruthy();
    expect(within(prefs).getByTestId('include-text-toggle')).toBeTruthy();
  });

  // ── 7. Default preferences inputs are present ────────────────────
  it('renders default preference inputs', () => {
    render(Settings);
    expect(screen.getByLabelText('Default Question Count')).toBeTruthy();
    expect(screen.getByLabelText('Default MCQ %')).toBeTruthy();
  });

  // ── 8. Appearance controls are present ───────────────────────────
  it('renders appearance controls', () => {
    render(Settings);
    expect(screen.getByTestId('theme-dark')).toBeTruthy();
    expect(screen.getByTestId('accent-amber')).toBeTruthy();
    expect(screen.getByTestId('accent-cyan')).toBeTruthy();
    expect(screen.getByTestId('accent-magenta')).toBeTruthy();
  });

  // ── 9. Both action buttons exist ──────────────────────────────────
  it('renders save and reset buttons', () => {
    render(Settings);
    expect(screen.getByTestId('save-all-button')).toBeTruthy();
    expect(screen.getByTestId('reset-button')).toBeTruthy();
  });

  // ── 10. Save All Settings persists state ──────────────────────────
  it('Save All Settings calls saveSettings and shows toast', async () => {
    render(Settings);

    // Wait for the loadSettings effect to settle so we know the
    // page-level "save" reflects the current store defaults.
    await waitFor(() => {
      expect(settingsStore.loadSettings).toHaveBeenCalled();
    });

    const saveBtn = screen.getByTestId('save-all-button');
    await fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(settingsStore.saveSettings).toHaveBeenCalledTimes(1);
    });

    // Default preferences + theme + accent were persisted.
    const saved = vi.mocked(settingsStore.saveSettings).mock.calls[0][0];
    expect(saved.defaultQuestionCount).toBe(10);
    expect(saved.defaultMcqPercentage).toBe(70);
    expect(saved.defaultDifficulty).toBe('Medium');
    expect(saved.includeMcq).toBe(true);
    expect(saved.includeText).toBe(true);
    expect(settingsStore.updateSetting).toHaveBeenCalledWith('theme', 'dark');
    expect(settingsStore.updateSetting).toHaveBeenCalledWith('accent', 'amber');

    // Toast is visible.
    const toast = await screen.findByTestId('toast');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain('Settings saved successfully');
  });

  // ── 11. Toast auto-dismisses after 3s ─────────────────────────────
  it('auto-dismisses the success toast after 3 seconds', async () => {
    vi.useFakeTimers();
    try {
      render(Settings);

      await waitFor(() => {
        expect(settingsStore.loadSettings).toHaveBeenCalled();
      });

      await fireEvent.click(screen.getByTestId('save-all-button'));

      await waitFor(() => {
        expect(screen.getByTestId('toast')).toBeTruthy();
      });

      // Advance past the 3000ms dismiss timeout.
      vi.advanceTimersByTime(3100);

      await waitFor(() => {
        expect(screen.queryByTestId('toast')).toBeNull();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  // ── 12. Reset requires confirmation ──────────────────────────────
  it('clicking Reset opens a confirmation modal', async () => {
    render(Settings);
    await fireEvent.click(screen.getByTestId('reset-button'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('Reset all settings?');
    // resetToDefaults should NOT have been called yet.
    expect(settingsStore.resetToDefaults).not.toHaveBeenCalled();
  });

  // ── 13. Reset confirmation calls resetToDefaults ─────────────────
  it('confirming reset calls resetToDefaults and closes modal', async () => {
    render(Settings);
    await fireEvent.click(screen.getByTestId('reset-button'));

    const confirmBtn = await screen.findByTestId('reset-confirm-button');
    await fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(settingsStore.resetToDefaults).toHaveBeenCalledTimes(1);
    });
    // Modal is dismissed.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  // ── 14. Cancelling reset does not call resetToDefaults ────────────
  it('cancelling reset keeps current settings', async () => {
    render(Settings);
    await fireEvent.click(screen.getByTestId('reset-button'));

    const cancelBtn = await screen.findByRole('button', { name: 'Cancel' });
    await fireEvent.click(cancelBtn);

    expect(settingsStore.resetToDefaults).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  // ── 15. Reset success shows toast ────────────────────────────────
  it('reset success shows a confirmation toast', async () => {
    render(Settings);
    await fireEvent.click(screen.getByTestId('reset-button'));
    await fireEvent.click(await screen.findByTestId('reset-confirm-button'));

    const toast = await screen.findByTestId('toast');
    expect(toast.textContent).toContain('Settings reset to defaults');
  });

  // ── 16. Default question count input is wired ───────────────────
  it('changing default question count updates save payload', async () => {
    render(Settings);

    await waitFor(() => {
      expect(settingsStore.loadSettings).toHaveBeenCalled();
    });

    const input = screen.getByLabelText('Default Question Count') as HTMLInputElement;
    input.value = '25';
    await fireEvent.input(input);

    await fireEvent.click(screen.getByTestId('save-all-button'));

    await waitFor(() => {
      const saved = vi.mocked(settingsStore.saveSettings).mock.calls[0][0];
      expect(saved.defaultQuestionCount).toBe(25);
    });
  });

  // ── 17. Failure path shows error toast ──────────────────────────
  it('shows an error toast when save fails', async () => {
    vi.mocked(settingsStore.saveSettings).mockRejectedValueOnce(new Error('DB down'));

    render(Settings);

    await waitFor(() => {
      expect(settingsStore.loadSettings).toHaveBeenCalled();
    });

    await fireEvent.click(screen.getByTestId('save-all-button'));

    const toast = await screen.findByTestId('toast');
    expect(toast.textContent).toContain('DB down');
  });
});

afterEach(() => {
  vi.clearAllTimers();
});
