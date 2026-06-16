<script lang="ts">
  import SettingsForm from '../components/SettingsForm.svelte';
  import { settingsStore } from '../lib/settingsStore.svelte';
  import { mapApiError } from '../lib/errorUtils';
  import Tooltip from '../components/Tooltip.svelte';
  import Save from 'lucide-svelte/icons/save';
  import RotateCcw from 'lucide-svelte/icons/rotate-ccw';
  import Check from 'lucide-svelte/icons/check';
  import KeyRound from 'lucide-svelte/icons/key-round';
  import Sliders from 'lucide-svelte/icons/sliders';
  import Palette from 'lucide-svelte/icons/palette';
  import Info from 'lucide-svelte/icons/info';
  import Sparkles from 'lucide-svelte/icons/sparkles';

  // ── Local state for Default Preferences + Appearance ──────────────
  let questionCount = $state(10);
  let mcqPercentage = $state(70);
  let difficulty = $state<'Easy' | 'Medium' | 'Hard'>('Medium');
  let theme = $state<'dark' | 'light'>('dark');
  let accent = $state<'amber' | 'cyan' | 'magenta'>('amber');
  let includeMcq = $state(true);
  let includeText = $state(true);

  // ── Action state ──────────────────────────────────────────────────
  let saving = $state(false);
  let resetting = $state(false);
  let showResetConfirm = $state(false);

  // ── Toast state ───────────────────────────────────────────────────
  let toastVisible = $state(false);
  let toastMessage = $state('');
  let toastVariant = $state<'success' | 'error'>('success');
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Bootstrap settings from store on mount ────────────────────────
  $effect(() => {
    settingsStore.loadSettings().then(() => {
      questionCount = settingsStore.settings.defaultQuestionCount;
      mcqPercentage = settingsStore.settings.defaultMcqPercentage;
      difficulty = settingsStore.settings.defaultDifficulty;
      includeMcq = settingsStore.settings.includeMcq ?? false;
      includeText = settingsStore.settings.includeText ?? false;
    });
  });

  // ── Derived ───────────────────────────────────────────────────────
  const accentSwatch: Record<'amber' | 'cyan' | 'magenta', string> = {
    amber: 'oklch(0.82 0.14 85)',
    cyan: 'oklch(0.72 0.1 195)',
    magenta: 'oklch(0.7 0.18 330)',
  };

  // ── Toast helper ──────────────────────────────────────────────────
  function showToast(message: string, variant: 'success' | 'error' = 'success'): void {
    toastMessage = message;
    toastVariant = variant;
    toastVisible = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastVisible = false;
    }, 3000);
  }

  // ── Clamp helpers ─────────────────────────────────────────────────
  function clampCount(n: number): number {
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(50, Math.floor(n)));
  }

  function clampMcq(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.floor(n)));
  }

  // ── Save All Settings ─────────────────────────────────────────────
  async function handleSaveAll(): Promise<void> {
    if (saving) return;
    saving = true;
    try {
      await settingsStore.saveSettings({
        apiKey: settingsStore.settings.apiKey,
        model: settingsStore.settings.model,
        defaultQuestionCount: clampCount(questionCount),
        defaultMcqPercentage: clampMcq(mcqPercentage),
        defaultDifficulty: difficulty,
        personality: settingsStore.settings.personality,
        customInstructions: settingsStore.settings.customInstructions,
        includeMcq,
        includeText,
      });
      await settingsStore.updateSetting('theme', theme);
      await settingsStore.updateSetting('accent', accent);
      showToast('Settings saved successfully');
    } catch (e) {
      showToast(mapApiError(e), 'error');
    } finally {
      saving = false;
    }
  }

  // ── Reset to Defaults ─────────────────────────────────────────────
  function handleResetClick(): void {
    showResetConfirm = true;
  }

  function handleResetCancel(): void {
    if (resetting) return;
    showResetConfirm = false;
  }

  async function handleResetConfirm(): Promise<void> {
    resetting = true;
    try {
      settingsStore.resetToDefaults();
      questionCount = 10;
      mcqPercentage = 70;
      difficulty = 'Medium';
      theme = 'dark';
      accent = 'amber';
      includeMcq = true;
      includeText = true;
      showResetConfirm = false;
      showToast('Settings reset to defaults');
    } finally {
      resetting = false;
    }
  }
</script>

<section class="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-0">
  <!-- ── Page header ─────────────────────────────────────────────── -->
  <header class="space-y-1.5">
    <span class="micro-label">Configure</span>
    <h1 class="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
      Settings
    </h1>
    <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
      Manage your OpenRouter API key, default generation preferences, and appearance.
    </p>
  </header>

  <hr class="section-divider m-0" />

  <!-- ── Section 1 · API Settings ──────────────────────────────────── -->
  <article class="surface-card p-6 sm:p-8 space-y-4" data-testid="section-api">
    <div class="flex items-start gap-3">
      <div
        class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30"
        aria-hidden="true"
      >
        <KeyRound size={18} strokeWidth="2.25" />
      </div>
      <div class="space-y-1">
        <h2 class="font-display text-xl font-bold text-foreground">API Settings</h2>
        <p class="text-sm text-muted-foreground">
          Connect Pressey to OpenRouter with your key and preferred model. The key stays on this device.
        </p>
      </div>
    </div>

    <hr class="section-divider m-0" />

    <!--
      SettingsForm owns its own state for the API key, model, and the
      "default" preferences that live alongside the form. Its own Save
      button persists those values to the store.
    -->
    <SettingsForm />
  </article>

  <!-- ── Section 2 · Default Preferences ───────────────────────────── -->
  <article class="surface-card p-6 sm:p-8 space-y-5" data-testid="section-preferences">
    <div class="flex items-start gap-3">
      <div
        class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent ring-1 ring-accent/30"
        aria-hidden="true"
      >
        <Sliders size={18} strokeWidth="2.25" />
      </div>
      <div class="space-y-1">
        <h2 class="font-display text-xl font-bold text-foreground">Default Preferences</h2>
        <p class="text-sm text-muted-foreground">
          Defaults used when generating a new test. These are applied if you skip the form.
        </p>
      </div>
    </div>

    <hr class="section-divider m-0" />

    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div class="space-y-1.5">
        <label class="micro-label block" for="default-question-count">Default Question Count</label>
        <div class="flex items-center gap-3">
          <input
            id="default-question-count"
            type="number"
            min="1"
            max="50"
            bind:value={questionCount}
            class="w-24 rounded-lg border border-border bg-background/30 px-3 py-2 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent"
          />
          <span class="font-mono text-xs text-muted-foreground">1 – 50</span>
        </div>
      </div>

      {#if includeMcq && includeText}
        <div class="space-y-1.5">
          <div class="flex items-baseline justify-between">
            <label class="micro-label" for="default-mcq-slider">Default MCQ %</label>
            <span class="font-mono text-sm text-foreground">{clampMcq(mcqPercentage)}%</span>
          </div>
          <input
            id="default-mcq-slider"
            type="range"
            min="0"
            max="100"
            bind:value={mcqPercentage}
            class="w-full accent-primary cursor-pointer"
          />
          <div class="flex justify-between font-mono text-[10px] text-muted-foreground/60">
            <span>0</span><span>50</span><span>100</span>
          </div>
        </div>
      {/if}

      <div class="sm:col-span-2 space-y-3" data-testid="question-type-toggles">
        <span class="micro-label block">Question Types</span>
        <div class="flex flex-wrap gap-6">
          <label class="flex cursor-pointer items-center gap-3" for="include-mcq">
            <span class="toggle-switch" data-on={includeMcq}>
              <input
                type="checkbox"
                id="include-mcq"
                data-testid="include-mcq-toggle"
                role="switch"
                bind:checked={includeMcq}
                class="sr-only"
              />
              <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span>
            </span>
            <Tooltip text="MCQ = Multiple Choice Questions">
              <span class="text-sm font-medium text-foreground">MCQ</span>
            </Tooltip>
          </label>
          <label class="flex cursor-pointer items-center gap-3" for="include-text">
            <span class="toggle-switch" data-on={includeText}>
              <input
                type="checkbox"
                id="include-text"
                data-testid="include-text-toggle"
                role="switch"
                bind:checked={includeText}
                class="sr-only"
              />
              <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span>
            </span>
            <span class="text-sm font-medium text-foreground">Open Response</span>
          </label>
        </div>
      </div>

      <div class="sm:col-span-2 space-y-1.5">
        <span class="micro-label block">Default Difficulty</span>
        <div class="inline-flex w-full overflow-hidden rounded-lg border border-border bg-background/30 sm:w-auto">
          {#each ['Easy', 'Medium', 'Hard'] as d (d)}
            <label
              class="flex-1 cursor-pointer px-5 py-2 text-center text-sm transition sm:flex-none"
              class:bg-primary={difficulty === d}
              class:text-primary-foreground={difficulty === d}
              class:text-muted-foreground={difficulty !== d}
              class:hover:text-foreground={difficulty !== d}
            >
              <input type="radio" bind:group={difficulty} value={d} class="sr-only" />
              {d}
            </label>
          {/each}
        </div>
      </div>
    </div>
  </article>

  <!-- ── Section 3 · Appearance ────────────────────────────────────── -->
  <article class="surface-card p-6 sm:p-8 space-y-5" data-testid="section-appearance">
    <div class="flex items-start gap-3">
      <div
        class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent ring-1 ring-accent/30"
        aria-hidden="true"
      >
        <Palette size={18} strokeWidth="2.25" />
      </div>
      <div class="space-y-1">
        <h2 class="font-display text-xl font-bold text-foreground">Appearance</h2>
        <p class="text-sm text-muted-foreground">
          Tune the look of the workspace. Changes apply to this device only.
        </p>
      </div>
    </div>

    <hr class="section-divider m-0" />

    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div class="space-y-1.5">
        <span class="micro-label block">Theme</span>
        <div class="inline-flex w-full overflow-hidden rounded-lg border border-border bg-background/30 sm:w-auto">
          {#each [{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }] as opt (opt.id)}
            <label
              class="flex-1 cursor-pointer px-5 py-2 text-center text-sm transition sm:flex-none"
              class:bg-primary={theme === opt.id}
              class:text-primary-foreground={theme === opt.id}
              class:text-muted-foreground={theme !== opt.id}
              class:hover:text-foreground={theme !== opt.id}
            >
              <input
                type="radio"
                bind:group={theme}
                value={opt.id}
                class="sr-only"
                data-testid="theme-{opt.id}"
              />
              {opt.label}
            </label>
          {/each}
        </div>
      </div>

      <div class="space-y-1.5">
        <span class="micro-label block">Accent</span>
        <div class="flex items-center gap-3">
          {#each ['amber', 'cyan', 'magenta'] as const as a (a)}
            {@const isActive = accent === a}
            <button
              type="button"
              onclick={() => (accent = a)}
              aria-pressed={isActive}
              aria-label="Accent {a}"
              class="relative h-9 w-9 rounded-full ring-2 transition"
              class:ring-foreground={isActive}
              class:ring-transparent={!isActive}
              class:hover:ring-muted-foreground={!isActive}
              style="background-color: {accentSwatch[a]};"
              data-testid="accent-{a}"
            >
              {#if isActive}
                <Check
                  size={14}
                  strokeWidth="3"
                  class="absolute inset-0 m-auto text-background"
                />
              {/if}
            </button>
          {/each}
          <span class="font-mono text-xs text-muted-foreground capitalize">{accent}</span>
        </div>
      </div>
    </div>
  </article>

  <!-- ── Section 4 · About ─────────────────────────────────────────── -->
  <article class="surface-card p-6 sm:p-8 space-y-4" data-testid="section-about">
    <div class="flex items-start gap-3">
      <div
        class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-foreground ring-1 ring-border"
        aria-hidden="true"
      >
        <Info size={18} strokeWidth="2.25" />
      </div>
      <div class="space-y-1">
        <h2 class="font-display text-xl font-bold text-foreground">About</h2>
        <p class="text-sm text-muted-foreground">
          Pressey — local-first AI test generator.
        </p>
      </div>
    </div>

    <hr class="section-divider m-0" />

    <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="flex items-center justify-between rounded-lg bg-background/30 px-4 py-2.5 ring-1 ring-border">
        <dt class="micro-label">Version</dt>
        <dd class="font-mono text-sm text-foreground">v0.1.0</dd>
      </div>
      <div class="flex items-center justify-between rounded-lg bg-background/30 px-4 py-2.5 ring-1 ring-border">
        <dt class="micro-label">Storage</dt>
        <dd class="font-mono text-sm text-foreground">Local · SQLite</dd>
      </div>
      <div class="flex items-center justify-between rounded-lg bg-background/30 px-4 py-2.5 ring-1 ring-border">
        <dt class="micro-label">Provider</dt>
        <dd class="font-mono text-sm text-foreground">{settingsStore.settings.provider}</dd>
      </div>
      <div class="flex items-center justify-between rounded-lg bg-background/30 px-4 py-2.5 ring-1 ring-border">
        <dt class="micro-label">Runtime</dt>
        <dd class="font-mono text-sm text-foreground">Tauri v2</dd>
      </div>
    </dl>

    <div class="command-strip">
      <Sparkles size={11} />
      <span>Built with Svelte 5 · Obsidian Studio design system</span>
    </div>
  </article>

  <!-- ── Action bar ───────────────────────────────────────────────── -->
  <div
    class="surface-card flex flex-col items-stretch gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
  >
    <p class="text-sm text-muted-foreground">
      Changes apply on save. Reset restores all preferences to defaults.
    </p>
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <button
        type="button"
        onclick={handleResetClick}
        data-testid="reset-button"
        class="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-foreground transition hover:bg-accent/10"
      >
        <RotateCcw size={15} />
        Reset to Defaults
      </button>
      <button
        type="button"
        onclick={handleSaveAll}
        disabled={saving}
        data-testid="save-all-button"
        class="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 font-medium text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
      >
        <Save size={15} />
        {saving ? 'Saving…' : 'Save All Settings'}
      </button>
    </div>
  </div>
</section>

<!-- ── Reset confirmation modal ─────────────────────────────────────── -->
{#if showResetConfirm}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    onclick={(e) => {
      if (e.target === e.currentTarget) handleResetCancel();
    }}
    role="presentation"
  >
    <div
      class="surface-card w-full max-w-md space-y-4 p-6 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
      tabindex="-1"
    >
      <div class="space-y-2">
        <div
          class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-warning/15"
        >
          <RotateCcw size={18} class="text-warning" />
        </div>
        <h2 id="reset-modal-title" class="font-display text-xl font-bold text-foreground">
          Reset all settings?
        </h2>
        <p class="text-sm text-muted-foreground">
          API key, model, default preferences, and appearance will be restored to their default
          values. This cannot be undone.
        </p>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onclick={handleResetCancel}
          disabled={resetting}
          class="rounded-lg border border-border px-4 py-2 text-foreground transition hover:bg-accent/10 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={handleResetConfirm}
          disabled={resetting}
          data-testid="reset-confirm-button"
          class="rounded-lg bg-destructive px-4 py-2 font-medium text-destructive-foreground transition hover:brightness-110 disabled:opacity-50"
        >
          {resetting ? 'Resetting…' : 'Reset'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Success toast ────────────────────────────────────────────────── -->
{#if toastVisible}
  <div
    class="fixed bottom-6 right-6 z-50 animate-[toastIn_0.25s_ease-out]"
    role="status"
    aria-live="polite"
    data-testid="toast"
  >
    <div
      class="surface-card flex items-center gap-3 px-4 py-3 shadow-2xl"
      class:ring-1={true}
      class:ring-success={toastVariant === 'success'}
    >
      <div
        class="grid h-7 w-7 place-items-center rounded-full"
        class:bg-success={toastVariant === 'success'}
        class:bg-destructive={toastVariant === 'error'}
      >
        <Check
          size={14}
          strokeWidth="3"
          class="text-background"
        />
      </div>
      <span class="text-sm font-medium text-foreground">{toastMessage}</span>
    </div>
  </div>
{/if}

<style>
  @keyframes toastIn {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* ── Toggle switch (question type toggles) ─────────────────────── */
  .toggle-switch {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
  }

  .toggle-track {
    width: 2.25rem;
    height: 1.25rem;
    background: var(--color-border);
    border-radius: 999px;
    position: relative;
    transition: background 0.2s;
  }

  .toggle-thumb {
    width: 1rem;
    height: 1rem;
    background: var(--color-foreground);
    border-radius: 50%;
    position: absolute;
    top: 0.125rem;
    left: 0.125rem;
    transition: transform 0.2s;
  }

  .toggle-switch[data-on='true'] .toggle-track {
    background: var(--color-primary);
  }

  .toggle-switch[data-on='true'] .toggle-thumb {
    transform: translateX(1rem);
  }

  .toggle-switch input:focus-visible + .toggle-track {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
</style>
