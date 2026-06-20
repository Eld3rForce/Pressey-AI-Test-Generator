<script lang="ts">
  import { settingsStore } from '../lib/settingsStore.svelte';
  import { validateProvider, mapApiError } from '../lib/errorUtils';
  import {
    PERSONALITIES,
    CUSTOM_PERSONALITY_ID,
  } from '../lib/personalities';
  import Tooltip from './Tooltip.svelte';
  import type { ProviderType } from '../lib/types';

  let apiKey = $state('');
  let model = $state('openai/gpt-4o');
  let questionCount = $state(10);
  let mcqPercentage = $state(70);
  let difficulty = $state<'Easy' | 'Medium' | 'Hard'>('Medium');
  let personality = $state('none');
  let customInstructions = $state('');
  // Research settings
  let enableResearch = $state(false);
  let researchMaxResults = $state(5);
  let researchMaxSnippetChars = $state(800);
  // Provider-selection state
  let provider = $state<ProviderType>('openrouter');
  let openaiKey = $state('');
  let anthropicKey = $state('');
  let geminiKey = $state('');
  let ollamaUrl = $state('http://localhost:11434');
  let openrouterKey = $state('');

  // Per-provider model lists (hardcoded curated lists)
  const providerModels: Record<ProviderType, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    gemini: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    ollama: [],
    openrouter: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-1.5-pro'],
  };

  const providerLabels: Record<ProviderType, { label: string; placeholder: string }> = {
    openai: { label: 'OpenAI API Key', placeholder: 'sk-...' },
    anthropic: { label: 'Anthropic API Key', placeholder: 'sk-ant-...' },
    gemini: { label: 'Gemini API Key', placeholder: 'AIza...' },
    ollama: { label: 'Ollama Base URL', placeholder: 'http://localhost:11434' },
    openrouter: { label: 'OpenRouter API Key', placeholder: 'sk-or-...' },
  };

  const modelDefaults: Record<ProviderType, string> = {
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20241022',
    gemini: 'gemini-1.5-pro',
    ollama: 'llama3.2',
    openrouter: 'openai/gpt-4o',
  };

  function getProviderKeyValue(): string {
    switch (provider) {
      case 'openai': return openaiKey;
      case 'anthropic': return anthropicKey;
      case 'gemini': return geminiKey;
      case 'ollama': return ollamaUrl;
      case 'openrouter': return openrouterKey;
    }
  }

  function setProviderKeyValue(value: string) {
    switch (provider) {
      case 'openai': openaiKey = value; break;
      case 'anthropic': anthropicKey = value; break;
      case 'gemini': geminiKey = value; break;
      case 'ollama': ollamaUrl = value; break;
      case 'openrouter': openrouterKey = value; break;
    }
  }

  function handleProviderChange(newProvider: ProviderType) {
    const models = providerModels[newProvider];
    if (models.length > 0 && !models.includes(model)) {
      model = modelDefaults[newProvider];
    }
  }

  // Use action to attach direct DOM listener (avoids Svelte 5 event delegation)
  function trackProviderChange(node: HTMLSelectElement) {
    function onChange(e: Event) {
      const target = e.currentTarget as HTMLSelectElement;
      const newProvider = target.value as ProviderType;
      provider = newProvider;
      handleProviderChange(newProvider);
    }
    node.addEventListener('change', onChange);
    return {
      destroy() {
        node.removeEventListener('change', onChange);
      }
    };
  }

  let saving = $state(false);
  let testing = $state(false);
  let testResult = $state<'success' | 'error' | null>(null);
  let saveMessage = $state('');
  let saveMessageType = $state<'success' | 'error'>('success');

  const isCustom = $derived(personality === CUSTOM_PERSONALITY_ID);

  $effect(() => {
    settingsStore.loadSettings().then(() => {
      provider = (settingsStore.settings.provider as ProviderType) || 'openrouter';
      openaiKey = settingsStore.settings.openaiKey || '';
      anthropicKey = settingsStore.settings.anthropicKey || '';
      geminiKey = settingsStore.settings.geminiKey || '';
      ollamaUrl = settingsStore.settings.ollamaUrl || 'http://localhost:11434';
      openrouterKey = settingsStore.settings.openrouterKey || '';
      apiKey = settingsStore.settings.apiKey || '';
      model = settingsStore.settings.model || modelDefaults[provider];
      questionCount = settingsStore.settings.defaultQuestionCount;
      mcqPercentage = settingsStore.settings.defaultMcqPercentage;
      difficulty = settingsStore.settings.defaultDifficulty;
      personality = settingsStore.settings.personality || 'none';
      customInstructions = settingsStore.settings.customInstructions || '';
      enableResearch = settingsStore.settings.enableResearch ?? false;
      researchMaxResults = settingsStore.settings.researchMaxResults ?? 5;
      researchMaxSnippetChars = settingsStore.settings.researchMaxSnippetChars ?? 800;
    });
  });

  async function handleTestConnection() {
    const key = getProviderKeyValue();
    if (!key) {
      testResult = 'error';
      return;
    }
    testing = true;
    testResult = null;
    // Set provider on store so testApiConnection uses the right endpoint
    settingsStore.settings.provider = provider;
    const ok = await settingsStore.testApiConnection(key);
    testResult = ok ? 'success' : 'error';
    testing = false;
    if (testResult === 'success') {
      setTimeout(() => {
        testResult = null;
      }, 3000);
    }
  }

  async function handleSave() {
    const settingsToSave = {
      apiKey: openrouterKey || apiKey,
      model,
      defaultQuestionCount: questionCount,
      defaultMcqPercentage: mcqPercentage,
      defaultDifficulty: difficulty,
      personality,
      customInstructions: isCustom ? customInstructions : '',
      provider,
      openaiKey,
      anthropicKey,
      geminiKey,
      ollamaUrl,
      openrouterKey: openrouterKey || apiKey,
      includeMcq: settingsStore.settings.includeMcq,
      includeText: settingsStore.settings.includeText,
      enableResearch,
      researchMaxResults,
      researchMaxSnippetChars,
    };
    const validation = validateProvider(provider, settingsToSave);
    if (!validation.valid) {
      saveMessage = validation.error?.message || 'Invalid API key';
      saveMessageType = 'error';
      return;
    }
    saving = true;
    saveMessage = '';
    try {
      await settingsStore.saveSettings(settingsToSave);
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

  <!-- ── Provider ──────────────────────────────────────────────── -->
  <div>
    <label class="micro-label mb-2 block" for="provider-select">Provider</label>
    <select
      id="provider-select"
      data-testid="provider-select"
      use:trackProviderChange
      class="w-full bg-background/30 rounded-lg border border-border px-4 py-2 text-foreground focus:ring-2 focus:ring-accent outline-none cursor-pointer"
    >
      <option value="openai" selected={provider === 'openai'}>OpenAI</option>
      <option value="anthropic" selected={provider === 'anthropic'}>Anthropic</option>
      <option value="gemini" selected={provider === 'gemini'}>Google Gemini</option>
      <option value="ollama" selected={provider === 'ollama'}>Ollama (Local)</option>
      <option value="openrouter" selected={provider === 'openrouter'}>OpenRouter</option>
    </select>
  </div>

  <!-- ── API Key / URL (per-provider) ──────────────────────────── -->
  <div>
    <label class="micro-label mb-2 block" for="api-key-input">{providerLabels[provider].label}</label>
    <input
      id="api-key-input"
      data-testid="api-key-input"
      type={provider === 'ollama' ? 'url' : 'password'}
      value={getProviderKeyValue()}
      oninput={(e) => setProviderKeyValue(e.currentTarget.value)}
      placeholder={providerLabels[provider].placeholder}
      class="w-full bg-background/30 rounded-lg border border-border px-4 py-2 text-foreground focus:ring-2 focus:ring-accent outline-none transition"
    />
    {#if provider === 'anthropic'}
      <p class="text-xs text-muted-foreground mt-1">
        Note: Anthropic currently routes through OpenRouter. Your Anthropic API key is stored for future use.
      </p>
    {/if}
  </div>

  <!-- ── Model (per-provider) ───────────────────────────────────── -->
  {#if providerModels[provider].length > 0}
    <div>
      <label class="micro-label mb-2 block" for="model-select">Model</label>
      <select
        id="model-select"
        data-testid="model-input"
        bind:value={model}
        class="w-full bg-background/30 rounded-lg border border-border px-4 py-2 text-foreground focus:ring-2 focus:ring-accent outline-none cursor-pointer"
      >
        {#each providerModels[provider] as m (m)}
          <option value={m}>{m}</option>
        {/each}
      </select>
    </div>
  {:else}
    <div>
      <label class="micro-label mb-2 block" for="model-input">Model</label>
      <input
        id="model-input"
        data-testid="model-input"
        type="text"
        bind:value={model}
        placeholder="llama3.2, mistral, codellama..."
        class="w-full bg-background/30 rounded-lg border border-border px-4 py-2 text-foreground focus:ring-2 focus:ring-accent outline-none transition"
      />
    </div>
  {/if}

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
    <Tooltip text="MCQ = Multiple Choice Questions">
      <label class="micro-label mb-2 block" for="mcq-percentage-slider"
        >MCQ Percentage: {mcqPercentage}%</label
      >
    </Tooltip>
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

  <!-- ── Research Settings ────────────────────────────────────── -->
  <div class="border-t border-border pt-4">
    <label class="flex items-center gap-2 text-foreground cursor-pointer">
      <input
        type="checkbox"
        bind:checked={enableResearch}
        data-testid="enable-research-checkbox"
        class="accent-primary"
      />
      Enable Research (DuckDuckGo Web Search)
    </label>
  </div>

  {#if enableResearch}
    <div>
      <label class="micro-label mb-2 block" for="research-max-results-input">
        Max Results (1–10)
      </label>
      <input
        id="research-max-results-input"
        type="number"
        bind:value={researchMaxResults}
        min="1"
        max="10"
        data-testid="research-max-results-input"
        class="w-full bg-background/30 rounded-lg border border-border px-4 py-2 text-foreground focus:ring-2 focus:ring-accent outline-none"
      />
    </div>
    <div>
      <label class="micro-label mb-2 block" for="research-max-snippet-chars-input">
        Max Snippet Characters (100–2000)
      </label>
      <input
        id="research-max-snippet-chars-input"
        type="number"
        bind:value={researchMaxSnippetChars}
        min="100"
        max="2000"
        data-testid="research-max-snippet-chars-input"
        class="w-full bg-background/30 rounded-lg border border-border px-4 py-2 text-foreground focus:ring-2 focus:ring-accent outline-none"
      />
    </div>
  {/if}

  <div class="flex gap-3 pt-4 border-t border-border">
    <button
      type="button"
      data-testid="test-connection-button"
      onclick={handleTestConnection}
      disabled={testing || !getProviderKeyValue()}
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
