<script lang="ts">
  import { generateFromPrompt, generateFromFile } from '../lib/testGenerator';
  import { validateToggles, mapApiError, validatePrompt, validateProvider } from '../lib/errorUtils';
  import { getProviderKey } from '../lib/providers/registry';
  import { uploadFile } from '../lib/fileUpload';
  import { createTest } from '../lib/dbService';
  import { settingsStore } from '../lib/settingsStore.svelte';
  import { buildPersonalityPrefix } from '../lib/personalities';
  import Tooltip from '../components/Tooltip.svelte';
  import type { Test, Question, TestConfig } from '../lib/types';

  // ── Form state ──────────────────────────────────────────────────
  let prompt = $state('');
  let topic = $state('');
  let questionCount = $state(10);
  let mcqPercentage = $state(70);
  let difficulty = $state<'Easy' | 'Medium' | 'Hard'>('Medium');
  // Question type toggles — when only one is on, mcqPercentage slider is hidden
  // and all generated questions are forced to that type.
  let includeMcq = $state(true);
  let includeText = $state(true);
  let toggleError = $state<string | null>(null);

  // ── File state ──────────────────────────────────────────────────
  let selectedFile = $state<{
    name: string;
    type: string;
    content: string;
    size: number;
  } | null>(null);
  let fileError = $state<string | null>(null);
  let uploading = $state(false);

  // ── Generation state ────────────────────────────────────────────
  let generating = $state(false);
  let apiError = $state<string | null>(null);
  let generatedTest = $state<Test | null>(null);
  let editableQuestions = $state<Question[]>([]);
  let editedTitle = $state('');
  let showAnswers = $state(false);

  // ── Per-question reveal state ────────────────────────────────────
  let revealedAnswers = $state(new Set<number>());
  let revealedExplanations = $state(new Set<number>());

  function toggleRevealAnswer(index: number) {
    const next = new Set(revealedAnswers);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    revealedAnswers = next;
  }

  function toggleRevealExplanation(index: number) {
    const next = new Set(revealedExplanations);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    revealedExplanations = next;
  }

  function isAnswerRevealed(index: number): boolean {
    return showAnswers || revealedAnswers.has(index);
  }

  function isExplanationRevealed(index: number): boolean {
    return showAnswers || revealedExplanations.has(index);
  }

  // ── Save state ──────────────────────────────────────────────────
  let saving = $state(false);
  let saveMessage = $state<{ text: string; type: 'success' | 'error' } | null>(null);
  let savedTestId = $state<number | null>(null);

  // ── Settings bootstrap ──────────────────────────────────────────
  $effect(() => {
    if (!settingsStore.loaded) {
      settingsStore.loadSettings();
    }
  });

  // ── Derived ─────────────────────────────────────────────────────
  const hasInput = $derived(prompt.trim() !== '' || selectedFile !== null);
  // Toggles valid = at least one of MCQ / text is selected. Re-checked at
  // submit time via validateToggles so we surface the API-friendly error
  // string; the derived just gates the button.
  const togglesValid = $derived(validateToggles(includeMcq, includeText).valid);
  const showMcqSlider = $derived(includeMcq && includeText);
  const canGenerate = $derived(
    !generating &&
      !saving &&
      hasInput &&
      !!getProviderKey(settingsStore.settings, settingsStore.settings.provider ?? 'openrouter') &&
      togglesValid
  );
  const canSave = $derived(
    !saving && !generating && generatedTest !== null && editableQuestions.length > 0
  );

  // ── Helpers ─────────────────────────────────────────────────────
  function clampCount(n: number): number {
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(50, Math.floor(n)));
  }

  function clampMcq(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.floor(n)));
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function fileTypeLabel(type: string): string {
    switch (type) {
      case 'pdf':
        return 'PDF';
      case 'md':
        return 'Markdown';
      case 'txt':
        return 'Text';
      default:
        return type.toUpperCase();
    }
  }

  // ── File upload ─────────────────────────────────────────────────
  async function handleFileUpload() {
    fileError = null;
    uploading = true;
    try {
      const result = await uploadFile();
      const size = new Blob([result.content]).size;
      selectedFile = {
        name: result.fileName,
        type: result.fileType,
        content: result.content,
        size,
      };
    } catch (e) {
      const msg = mapApiError(e);
      // "No file selected" = user cancelled the dialog — not a real error
      if (!msg.toLowerCase().includes('no file selected')) {
        fileError = msg;
      }
    } finally {
      uploading = false;
    }
  }

  function handleClearFile() {
    selectedFile = null;
    fileError = null;
  }

  // ── Generate ────────────────────────────────────────────────────
  async function handleGenerate() {
    apiError = null;
    saveMessage = null;
    savedTestId = null;
    generatedTest = null;
    editableQuestions = [];
    editedTitle = '';
    revealedAnswers = new Set();
    revealedExplanations = new Set();

    // Input validation before making API call. We always run these checks so
    // a click on the button surfaces a helpful error even when canGenerate
    // is false (e.g. toggles both off → show "Select at least one").
    const promptValidation = validatePrompt(prompt.trim(), selectedFile !== null);
    if (!promptValidation.valid && promptValidation.error) {
      apiError = promptValidation.error.message;
      return;
    }

    const apiKeyValidation = validateProvider(settingsStore.settings.provider ?? 'openrouter', settingsStore.settings);
    if (!apiKeyValidation.valid && apiKeyValidation.error) {
      apiError = apiKeyValidation.error.message;
      return;
    }

    // Toggle validation — must have at least one question type selected.
    // Update the inline toggle error so the UI shows the message next to the
    // toggles in addition to (or instead of) the global apiError.
    const togglesValidation = validateToggles(includeMcq, includeText);
    if (!togglesValidation.valid && togglesValidation.error) {
      toggleError = togglesValidation.error.message;
      apiError = togglesValidation.error.message;
      return;
    }
    toggleError = null;

    if (!canGenerate) return;
    generating = true;

    // Effective MCQ percentage: when only one toggle is on, force the split
    // to 100% of the active type so downstream code never sees an inconsistent
    // (e.g. mcq=70 with text=off) configuration.
    const effectiveMcqPct = !includeText
      ? 100
      : !includeMcq
        ? 0
        : clampMcq(mcqPercentage);

    const config: TestConfig = {
      questionCount: clampCount(questionCount),
      mcqPercentage: effectiveMcqPct,
      includeMcq,
      includeText,
      provider: settingsStore.settings.provider,
      difficulty,
      ...(topic.trim() ? { topic: topic.trim() } : {}),
    };
    // Use the per-provider key for the active provider (not the legacy apiKey)
    // so the right credentials are sent for openai/anthropic/gemini/ollama/openrouter.
    const activeProvider = settingsStore.settings.provider ?? 'openrouter';
    const apiKey = getProviderKey(settingsStore.settings, activeProvider) ?? '';

    const personalityPrompt = buildPersonalityPrefix(
      settingsStore.settings.personality,
      settingsStore.settings.customInstructions
    );

    try {
      let test: Test;
      if (selectedFile) {
        test = await generateFromFile(
          selectedFile.content,
          selectedFile.name,
          config,
          apiKey,
          personalityPrompt || undefined,
          prompt.trim() || undefined
        );
      } else {
        test = await generateFromPrompt(
          prompt.trim(),
          config,
          apiKey,
          personalityPrompt || undefined
        );
      }
      generatedTest = test;
      editedTitle = test.title;
      editableQuestions = test.questions.map((q) => ({
        ...q,
        options: q.options ? [...q.options] : undefined,
      }));
    } catch (e) {
      apiError = mapApiError(e);
    } finally {
      generating = false;
    }
  }

  // ── Question editing helpers ────────────────────────────────────
  function updateQuestionText(index: number, text: string) {
    editableQuestions[index].text = text;
    editableQuestions = [...editableQuestions];
  }

  function updateExplanation(index: number, explanation: string) {
    editableQuestions[index].explanation = explanation;
    editableQuestions = [...editableQuestions];
  }

  function updateCorrectAnswer(index: number, value: string) {
    editableQuestions[index].correctAnswer = value;
    editableQuestions = [...editableQuestions];
  }

  function updateOption(qIndex: number, optIndex: number, value: string) {
    const opts = [...(editableQuestions[qIndex].options ?? [])];
    opts[optIndex] = value;
    editableQuestions[qIndex].options = opts;
    // If the correctAnswer pointed at the old text, keep it pointing at the
    // updated text so we don't silently invalidate the answer.
    editableQuestions = [...editableQuestions];
  }

  // ── Save ────────────────────────────────────────────────────────
  async function handleSave() {
    if (!canSave || !generatedTest) return;
    saving = true;
    saveMessage = null;
    try {
      const questions: Question[] = editableQuestions.map((q, i) => {
        const base: Question = {
          type: q.type,
          text: q.text,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          orderIndex: i,
        };
        if (q.type === 'mcq') {
          base.options = (q.options ?? []).filter((o) => o.trim() !== '');
        }
        return base;
      });

      const testToSave: Test = {
        ...generatedTest,
        title: editedTitle.trim() || generatedTest.title,
        topic: generatedTest.topic ?? (topic.trim() || undefined),
        difficulty: generatedTest.difficulty || difficulty,
        questionCount: questions.length,
        mcqPercentage: clampMcq(mcqPercentage),
        questions,
      };

      const id = await createTest(testToSave);
      savedTestId = id;
      saveMessage = { text: `Test saved to library (ID #${id})`, type: 'success' };
      setTimeout(() => {
        if (saveMessage?.text.startsWith('Test saved')) {
          saveMessage = null;
        }
      }, 6000);
    } catch (e) {
      saveMessage = {
        text: mapApiError(e),
        type: 'error',
      };
    } finally {
      saving = false;
    }
  }

  function handleReset() {
    generatedTest = null;
    editableQuestions = [];
    editedTitle = '';
    apiError = null;
    saveMessage = null;
    savedTestId = null;
  }
</script>

<div class="mx-auto max-w-5xl px-6 py-10 space-y-8">
  <!-- ── Header ──────────────────────────────────────────────── -->
  <header class="text-center space-y-2">
    <p class="micro-label">AI-Powered Test Creation</p>
    <h1 class="font-display text-4xl md:text-5xl font-bold text-foreground tracking-tight">
      Generate Test
    </h1>
    <p class="text-muted-foreground text-sm max-w-md mx-auto">
      Describe a topic or upload source material — the AI authors a question set you can review and edit.
    </p>
  </header>

  <!-- ── Form: Prompt + Config ───────────────────────────────── -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
    <!-- Prompt -->
    <section class="md:col-span-2 surface-card p-6 space-y-4">
      <div>
        <label class="micro-label mb-2 block" for="prompt-textarea">Prompt</label>
        <textarea
          id="prompt-textarea"
          bind:value={prompt}
          rows="8"
          placeholder="Describe the test topic or paste content..."
          class="w-full bg-background/30 rounded-lg border border-border px-4 py-3 text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-accent outline-none transition resize-y min-h-32"
        ></textarea>
      </div>
      <div>
        <label class="micro-label mb-2 block" for="topic-input">Topic (optional)</label>
        <input
          id="topic-input"
          type="text"
          bind:value={topic}
          placeholder="e.g. Photosynthesis, World War II, JavaScript closures"
          class="w-full bg-background/30 rounded-lg border border-border px-4 py-2 text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-accent outline-none transition"
        />
      </div>
    </section>

    <!-- Config -->
    <aside class="surface-card p-6 space-y-5">
      <p class="micro-label">Configuration</p>

      <div>
        <label class="micro-label mb-2 block" for="question-count-input">
          Questions <span class="text-foreground/70 normal-case tracking-normal">{clampCount(questionCount)}</span>
        </label>
        <input
          id="question-count-input"
          type="number"
          min="1"
          max="50"
          value={questionCount}
          oninput={(e) => (questionCount = clampCount(Number((e.currentTarget as HTMLInputElement).value)))}
          class="w-full bg-background/30 rounded-lg border border-border px-3 py-2 text-foreground focus:ring-2 focus:ring-accent outline-none"
        />
      </div>

      <div>
        <span class="micro-label mb-2 block">Question Types</span>
        <div class="space-y-2">
          <label
            class="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-background/30 cursor-pointer transition hover:border-accent/40"
            class:opacity-60={!includeMcq}
            for="toggle-mcq"
          >
            <Tooltip text="MCQ = Multiple Choice Questions">
              <span class="text-sm text-foreground font-medium">Multiple Choice</span>
            </Tooltip>
            <span class="toggle-switch" data-on={includeMcq}>
              <input
                id="toggle-mcq"
                data-testid="toggle-mcq"
                type="checkbox"
                role="switch"
                bind:checked={includeMcq}
                class="sr-only peer"
              />
              <span class="toggle-track" aria-hidden="true">
                <span class="toggle-thumb"></span>
              </span>
            </span>
          </label>

          <label
            class="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-background/30 cursor-pointer transition hover:border-accent/40"
            class:opacity-60={!includeText}
            for="toggle-text"
          >
            <span class="text-sm text-foreground font-medium">Open Response</span>
            <span class="toggle-switch" data-on={includeText}>
              <input
                id="toggle-text"
                data-testid="toggle-text"
                type="checkbox"
                role="switch"
                bind:checked={includeText}
                class="sr-only peer"
              />
              <span class="toggle-track" aria-hidden="true">
                <span class="toggle-thumb"></span>
              </span>
            </span>
          </label>
        </div>

        {#if toggleError}
          <p
            data-testid="toggle-error"
            class="mt-2 text-xs text-destructive font-mono"
            role="alert"
          >
            {toggleError}
          </p>
        {/if}

        {#if showMcqSlider}
          <div class="mt-4">
            <div class="flex items-baseline justify-between mb-2">
              <Tooltip text="MCQ = Multiple Choice Questions">
                <label class="micro-label" for="mcq-percentage-slider">MCQ %</label>
              </Tooltip>
              <span class="font-mono text-sm text-foreground">{clampMcq(mcqPercentage)}%</span>
            </div>
            <input
              id="mcq-percentage-slider"
              data-testid="mcq-percentage-slider"
              type="range"
              min="0"
              max="100"
              value={mcqPercentage}
              oninput={(e) => (mcqPercentage = clampMcq(Number((e.currentTarget as HTMLInputElement).value)))}
              class="w-full accent-primary cursor-pointer"
            />
            <div class="flex justify-between text-[10px] font-mono text-muted-foreground/60 mt-1">
              <span>0</span><span>50</span><span>100</span>
            </div>
          </div>
        {/if}
      </div>

      <div>
        <span class="micro-label mb-2 block">Difficulty</span>
        <div class="flex gap-1 p-1 bg-background/30 rounded-lg border border-border">
          {#each ['Easy', 'Medium', 'Hard'] as d (d)}
            <label
              class="flex-1 text-center text-sm py-1.5 rounded-md cursor-pointer transition"
              class:bg-primary={difficulty === d}
              class:text-primary-foreground={difficulty === d}
              class:hover:bg-secondary={difficulty !== d}
            >
              <input
                type="radio"
                bind:group={difficulty}
                value={d}
                class="sr-only"
              />
              {d}
            </label>
          {/each}
        </div>
      </div>
    </aside>
  </div>

  <!-- ── File Upload ─────────────────────────────────────────── -->
  <section class="surface-card p-6 space-y-3">
    <p class="micro-label">Source Material</p>

    {#if !selectedFile}
      <button
        type="button"
        onclick={handleFileUpload}
        disabled={uploading}
        class="w-full group flex flex-col items-center justify-center gap-2 py-10 rounded-lg border-2 border-dashed border-border bg-background/20 hover:border-accent/60 hover:bg-accent/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {#if uploading}
          <div class="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
          <span class="text-sm text-muted-foreground">Reading file…</span>
        {:else}
          <svg class="w-8 h-8 text-muted-foreground group-hover:text-accent transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div class="text-center">
            <p class="text-sm font-medium text-foreground">Upload File</p>
            <p class="text-xs text-muted-foreground mt-1">
              Click to browse · .txt, .md, .pdf · up to 10 MB
            </p>
          </div>
        {/if}
      </button>
    {:else}
      <div class="flex items-center gap-3 p-4 rounded-lg bg-background/30 border border-border">
        <div class="flex-shrink-0 w-10 h-10 rounded-md bg-primary/15 flex items-center justify-center">
          <span class="font-mono text-[10px] font-semibold text-primary uppercase">
            {fileTypeLabel(selectedFile.type)}
          </span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
          <p class="text-xs text-muted-foreground font-mono">{formatBytes(selectedFile.size)}</p>
        </div>
        <button
          type="button"
          onclick={handleClearFile}
          class="px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition"
        >
          Remove
        </button>
      </div>
    {/if}

    {#if fileError}
      <div class="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
        <svg class="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.94 6.94a1.5 1.5 0 112.12 2.12L10 10.12l-1.06 1.06a1.5 1.5 0 11-2.12-2.12L7.88 8 6.82 6.94a1.5 1.5 0 112.12-2.12L10 5.88l1.06-1.06z" clip-rule="evenodd"/>
        </svg>
        <p class="text-sm text-destructive">{fileError}</p>
      </div>
    {/if}
  </section>

  <!-- ── Generate ────────────────────────────────────────────── -->
  <div class="command-strip w-full justify-between py-2 px-3">
    <span class="flex items-center gap-2">
      <span class="inline-block w-1.5 h-1.5 rounded-full bg-primary"></span>
      Ready to generate
    </span>
    <span class="text-[10px]">
      {clampCount(questionCount)} Q ·
      {#if includeMcq && includeText}
        {clampMcq(mcqPercentage)}% MCQ
      {:else if includeMcq}
        MCQ only
      {:else}
        Open Response only
      {/if}
      · {difficulty}
    </span>
  </div>

  <button
    type="button"
    onclick={handleGenerate}
    disabled={generating}
    class="w-full py-3.5 rounded-lg bg-primary text-primary-foreground font-display font-semibold text-lg tracking-wide hover:brightness-110 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 transition shadow-lg shadow-primary/20"
  >
    {#if generating}
      <span class="inline-flex items-center justify-center gap-3">
        <span class="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></span>
        Generating…
      </span>
    {:else}
      Generate Test
    {/if}
  </button>

  {#if !getProviderKey(settingsStore.settings, settingsStore.settings.provider ?? 'openrouter')}
    <p class="text-center text-xs text-warning font-mono">
      ⚠ No API key configured — add one in Settings to generate tests.
    </p>
  {/if}

  {#if apiError}
    <div class="surface-card border-destructive/40 bg-destructive/5 p-4 flex items-start gap-3">
      <svg class="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-11a1 1 0 112 0v3a1 1 0 11-2 0V7zm0 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" clip-rule="evenodd"/>
      </svg>
      <div class="flex-1">
        <p class="text-sm font-medium text-destructive">Generation failed</p>
        <p class="text-sm text-destructive/80 mt-1">{apiError}</p>
      </div>
      <button
        type="button"
        onclick={() => (apiError = null)}
        class="text-destructive/60 hover:text-destructive text-lg leading-none"
        aria-label="Dismiss error"
      >
        ×
      </button>
    </div>
  {/if}

  <!-- ── Preview ─────────────────────────────────────────────── -->
  {#if generatedTest && editableQuestions.length > 0}
    <section class="space-y-4 animate-[fadeIn_0.4s_ease-out]">
      <div class="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p class="micro-label">Preview</p>
          <h2 class="font-display text-2xl font-bold text-foreground mt-1">
            {editableQuestions.length} questions ready
          </h2>
        </div>
        <div class="flex items-center gap-4">
          <button
            type="button"
            onclick={() => (showAnswers = !showAnswers)}
            class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition"
          >
            {showAnswers ? 'Hide Answers' : 'Show Answers'}
          </button>
          <button
            type="button"
            onclick={handleReset}
            class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition"
          >
            Discard & start over
          </button>
        </div>
      </div>

      <!-- Editable title -->
      <div class="surface-card p-4">
        <label class="micro-label mb-2 block" for="test-title-input">Test Title</label>
        <input
          id="test-title-input"
          type="text"
          bind:value={editedTitle}
          class="w-full bg-background/30 rounded-lg border border-border px-3 py-2 text-foreground font-display focus:ring-2 focus:ring-accent outline-none"
        />
      </div>

      <!-- Question cards -->
      <div class="space-y-3">
        {#each editableQuestions as question, i (i)}
          <article
            class="surface-card p-5 space-y-3"
            style="animation: slideIn 0.35s ease-out {i * 40}ms backwards;"
          >
            <header class="flex items-center gap-3">
              <span class="font-mono text-xs text-muted-foreground">Q{i + 1}</span>
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wider"
                class:bg-primary={question.type === 'mcq'}
                class:text-primary-foreground={question.type === 'mcq'}
                class:bg-accent={question.type !== 'mcq'}
                class:text-accent-foreground={question.type !== 'mcq'}
              >
                {question.type === 'mcq' ? 'MCQ' : 'TEXT'}
              </span>
            </header>

            <div>
              <label class="micro-label mb-1.5 block" for={`q-text-${i}`}>Question</label>
              <textarea
                id={`q-text-${i}`}
                value={question.text}
                oninput={(e) => updateQuestionText(i, (e.currentTarget as HTMLTextAreaElement).value)}
                rows="2"
                class="w-full bg-background/30 rounded-lg border border-border px-3 py-2 text-foreground focus:ring-2 focus:ring-accent outline-none resize-y"
              ></textarea>
            </div>

            {#if question.type === 'mcq' && question.options}
              <div class="space-y-2 pl-3 border-l-2 border-primary/30">
                <p class="micro-label">Options</p>
                {#each question.options as opt, oi (oi)}
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-xs text-muted-foreground w-4">{String.fromCharCode(65 + oi)}</span>
                    <input
                      type="text"
                      value={opt}
                      oninput={(e) => updateOption(i, oi, (e.currentTarget as HTMLInputElement).value)}
                      class="flex-1 bg-background/30 rounded-md border border-border px-2 py-1.5 text-sm text-foreground focus:ring-2 focus:ring-accent outline-none"
                    />
                  </div>
                {/each}

                <div class="pt-1">
                  <label class="micro-label mb-1.5 block" for={`q-correct-${i}`}>Correct Answer</label>
                  {#if isAnswerRevealed(i)}
                    <select
                      id={`q-correct-${i}`}
                      value={question.correctAnswer}
                      onchange={(e) => updateCorrectAnswer(i, (e.currentTarget as HTMLSelectElement).value)}
                      class="w-full bg-background/30 rounded-md border border-border px-2 py-1.5 text-sm text-foreground focus:ring-2 focus:ring-accent outline-none cursor-pointer"
                    >
                      {#each question.options as opt, oi (oi)}
                        <option value={opt}>{String.fromCharCode(65 + oi)}. {opt || '(empty)'}</option>
                      {/each}
                    </select>
                  {:else}
                    <div
                      class="blur-placeholder"
                      role="button"
                      tabindex="0"
                      aria-label="Click to reveal answer"
                      onclick={() => toggleRevealAnswer(i)}
                      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRevealAnswer(i); } }}
                    >
                      Click to reveal answer
                    </div>
                  {/if}
                </div>
              </div>
            {:else}
              <div class="pl-3 border-l-2 border-accent/30">
                <label class="micro-label mb-1.5 block" for={`q-correct-${i}`}>Model Answer</label>
                {#if isAnswerRevealed(i)}
                  <textarea
                    id={`q-correct-${i}`}
                    value={question.correctAnswer}
                    oninput={(e) => updateCorrectAnswer(i, (e.currentTarget as HTMLTextAreaElement).value)}
                    rows="3"
                    class="w-full bg-background/30 rounded-md border border-border px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-accent outline-none resize-y"
                  ></textarea>
                {:else}
                  <div
                    class="blur-placeholder"
                    role="button"
                    tabindex="0"
                    aria-label="Click to reveal answer"
                    onclick={() => toggleRevealAnswer(i)}
                    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRevealAnswer(i); } }}
                  >
                    Click to reveal answer
                  </div>
                {/if}
              </div>
            {/if}

            <div>
              <label class="micro-label mb-1.5 block" for={`q-explain-${i}`}>Explanation</label>
              {#if isExplanationRevealed(i)}
                <textarea
                  id={`q-explain-${i}`}
                  value={question.explanation ?? ''}
                  oninput={(e) => updateExplanation(i, (e.currentTarget as HTMLTextAreaElement).value)}
                  rows="2"
                  class="w-full bg-background/30 rounded-md border border-border px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-accent outline-none resize-y"
                ></textarea>
              {:else}
                <div
                  class="blur-placeholder"
                  role="button"
                  tabindex="0"
                  aria-label="Click to reveal explanation"
                  onclick={() => toggleRevealExplanation(i)}
                  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRevealExplanation(i); } }}
                >
                  Click to reveal explanation
                </div>
              {/if}
            </div>
          </article>
        {/each}
      </div>

      <!-- Save -->
      <div class="surface-card p-5 space-y-3">
        <button
          type="button"
          onclick={handleSave}
          disabled={!canSave}
          class="w-full py-3 rounded-lg bg-primary text-primary-foreground font-display font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {#if saving}
            <span class="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></span>
            Saving…
          {:else if savedTestId !== null}
            ✓ Saved (ID #{savedTestId})
          {:else}
            Save Test
          {/if}
        </button>

        {#if saveMessage}
          <p
            class="text-sm text-center"
            class:text-success={saveMessage.type === 'success'}
            class:text-destructive={saveMessage.type === 'error'}
          >
            {saveMessage.text}
          </p>
        {/if}
      </div>
    </section>
  {/if}
</div>

<style>
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ── Toggle switch (question type toggles) ─────────────────────── */
  .toggle-switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .toggle-track {
    display: inline-block;
    width: 2.25rem;
    height: 1.25rem;
    border-radius: 9999px;
    background-color: var(--color-muted);
    border: 1px solid var(--color-border);
    position: relative;
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease;
  }

  .toggle-thumb {
    position: absolute;
    top: 50%;
    left: 2px;
    transform: translateY(-50%);
    width: 0.95rem;
    height: 0.95rem;
    border-radius: 9999px;
    background-color: var(--color-foreground);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.4);
    transition: transform 0.18s ease;
  }

  /* ON state — driven by the [data-on] attribute on the wrapper so we don't
     depend on :has() / :checked sibling selectors, which keeps the CSS
     portable and works without a Svelte preprocessing quirk. */
  .toggle-switch[data-on='true'] .toggle-track {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
  }

  .toggle-switch[data-on='true'] .toggle-thumb {
    transform: translate(1rem, -50%);
    background-color: var(--color-primary-foreground);
  }

  /* Keyboard focus ring on the underlying <input> (visually hidden) */
  .toggle-switch input:focus-visible + .toggle-track {
    box-shadow:
      0 0 0 2px var(--color-background),
      0 0 0 4px var(--color-accent);
  }

  /* ── Click-to-reveal blurred placeholder ──────────────────── */
  .blur-placeholder {
    filter: blur(8px);
    user-select: none;
    cursor: pointer;
    padding: 0.375rem 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid var(--color-border);
    background-color: var(--color-muted);
    color: var(--color-muted-foreground);
    text-align: center;
    font-size: 0.875rem;
  }

  .blur-placeholder:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
</style>
