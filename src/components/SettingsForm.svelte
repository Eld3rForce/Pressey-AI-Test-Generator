<script lang="ts">
  import { settingsStore } from '../lib/settingsStore.svelte';
  import { validateApiKey, mapApiError } from '../lib/errorUtils';
  import {
    PERSONALITIES,
    CUSTOM_PERSONALITY_ID,
  } from '../lib/personalities';

  let apiKey = $state('');
  let model = $state('openai/gpt-4o');
  let questionCount = $state(10);
  let mcqPercentage = $state(70);
  let difficulty = $state<'Easy' | 'Medium' | 'Hard'>('Medium');
  let personality = $state('none');
  let customInstructions = $state('');
  let saving = $state(false);
  let testing = $state(false);
  let testResult = $state<'success' | 'error' | null>(null);
  let saveMessage = $state('');
  let saveMessageType = $state<'success' | 'error'>('success');

  const isCustom = $derived(personality === CUSTOM_PERSONALITY_ID);

  $effect(() => {
    settingsStore.loadSettings().then(() => {
      apiKey = settingsStore.settings.apiKey;
      model = settingsStore.settings.model;
      questionCount = settingsStore.settings.defaultQuestionCount;
      mcqPercentage = settingsStore.settings.defaultMcqPercentage;
      difficulty = settingsStore.settings.defaultDifficulty;
      personality = settingsStore.settings.personality || 'none';
      customInstructions = settingsStore.settings.customInstructions || '';
    });
  });

  async function handleTestConnection() {
    const validation = validateApiKey(apiKey);
    if (!validation.valid) {
      testResult = 'error';
      return;
    }
    testing = true;
    testResult = null;
    const ok = await settingsStore.testApiConnection(apiKey);
    testResult = ok ? 'success' : 'error';
    testing = false;
    if (testResult === 'success') {
      setTimeout(() => {
        testResult = null;
      }, 3000);
    }
  }

  async function handleSave() {
    const validation = validateApiKey(apiKey);
    if (!validation.valid) {
      saveMessage = validation.error?.message || 'Invalid API key';
      saveMessageType = 'error';
      return;
    }
    saving = true;
    saveMessage = '';
    try {
      await settingsStore.saveSettings({
        apiKey,
        model,
        defaultQuestionCount: questionCount,
        defaultMcqPercentage: mcqPercentage,
        defaultDifficulty: difficulty,
        personality,
        customInstructions: isCustom ? customInstructions : '',
      });
      saveMessage = 'Settings saved successfully';
      saveMessageType = 'success';
      setTimeout(() => {
        saveMessage = '';
      }, 3000);
    } catch (e) {
      saveMessage = mapApiError(e);
      saveMessageType = 'error';
    } finally {
      saving = false;
    }
  }
</script>

<div class="surface-card p-6 space-y-6 max-w-lg">
  <h2 class="font-display text-xl font-bold text-foreground">Settings</h2>

  <div>
    <label class="micro-label mb-2 block" for="api-key-input">API Key</label>
    <input
      id="api-key-input"
      type="password"
      bind:value={apiKey}
      placeholder="sk-or-..."
      class="w-full bg-background/30 rounded-lg border border-border px-4 py-2 text-foreground focus:ring-2 focus:ring-accent outline-none transition"
    />
  </div>

  <div>
    <label class="micro-label mb-2 block" for="model-select">Model</label>
    <select
      id="model-select"
      bind:value={model}
      class="w-full bg-background/30 rounded-lg border border-border px-4 py-2 text-foreground focus:ring-2 focus:ring-accent outline-none cursor-pointer"
    >
      <option value="openai/gpt-4o">GPT-4o</option>
      <option value="openai/gpt-3.5-turbo">GPT-3.5 Turbo</option>
      <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
      <option value="google/gemini-pro">Gemini Pro</option>
    </select>
  </div>

  <div>
    <label class="micro-label mb-2 block" for="question-count-input"
      >Default Questions (1–50)</label
    >
    <input
      id="question-count-input"
      type="number"
      bind:value={questionCount}
      min="1"
      max="50"
      class="w-full bg-background/30 rounded-lg border border-border px-4 py-2 text-foreground focus:ring-2 focus:ring-accent outline-none"
    />
  </div>

  <div>
    <label class="micro-label mb-2 block" for="mcq-percentage-slider"
      >MCQ Percentage: {mcqPercentage}%</label
    >
    <input
      id="mcq-percentage-slider"
      type="range"
      bind:value={mcqPercentage}
      min="0"
      max="100"
      class="w-full accent-primary"
    />
  </div>

  <div>
    <span class="micro-label mb-2 block">Default Difficulty</span>
    <div class="flex gap-4">
      {#each ['Easy', 'Medium', 'Hard'] as d (d)}
        <label class="flex items-center gap-2 text-foreground cursor-pointer">
          <input
            type="radio"
            bind:group={difficulty}
            value={d}
            class="accent-primary"
          />
          {d}
        </label>
      {/each}
    </div>
  </div>

  <!-- ── AI Personality ─────────────────────────────────────────── -->
  <div>
    <label class="micro-label mb-2 block" for="personality-select">AI Personality</label>
    <select
      id="personality-select"
      bind:value={personality}
      class="w-full bg-background/30 rounded-lg border border-border px-4 py-2 text-foreground focus:ring-2 focus:ring-accent outline-none cursor-pointer"
    >
      <option value="none">None (default)</option>
      {#each PERSONALITIES as p (p.id)}
        <option value={p.id}>{p.name} — {p.description}</option>
      {/each}
      <option value={CUSTOM_PERSONALITY_ID}>Custom…</option>
    </select>
  </div>

  {#if isCustom}
    <div>
      <label class="micro-label mb-2 block" for="custom-instructions-input">
        Custom Instructions
      </label>
      <textarea
        id="custom-instructions-input"
        bind:value={customInstructions}
        maxlength="500"
        rows="4"
        placeholder="Describe how the AI should behave when generating tests…"
        class="w-full bg-background/30 rounded-lg border border-border px-4 py-2 text-foreground focus:ring-2 focus:ring-accent outline-none resize-y transition"
      ></textarea>
      <p class="mt-1 font-mono text-xs text-muted-foreground">
        {customInstructions.length}/500 characters
      </p>
    </div>
  {/if}

  <div class="flex gap-3 pt-4 border-t border-border">
    <button
      type="button"
      onclick={handleTestConnection}
      disabled={testing || !apiKey}
      class="px-4 py-2 rounded-lg border border-border text-muted-foreground hover:bg-accent/10 disabled:opacity-50 transition"
    >
      {testing ? 'Testing...' : 'Test Connection'}
    </button>
    <button
      type="button"
      onclick={handleSave}
      disabled={saving}
      class="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:brightness-110 disabled:opacity-50 transition"
    >
      {saving ? 'Saving...' : 'Save Settings'}
    </button>
  </div>

  {#if testResult === 'success'}
    <p class="text-success text-sm">✓ Connection successful!</p>
  {:else if testResult === 'error'}
    <p class="text-destructive text-sm">✗ Connection failed. Check your API key.</p>
  {/if}
  {#if saveMessage}
    <p
      class="text-sm"
      class:text-success={saveMessageType === 'success'}
      class:text-destructive={saveMessageType === 'error'}
    >
      {saveMessage}
    </p>
  {/if}
</div>
