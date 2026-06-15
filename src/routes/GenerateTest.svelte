<script lang="ts">
  import { generateFromPrompt, generateFromFile } from '../lib/testGenerator';
  import { validateToggles } from '../lib/errorUtils';
  import { uploadFile } from '../lib/fileUpload';
  import { createTest } from '../lib/dbService';
  import { settingsStore } from '../lib/settingsStore.svelte';
  import { buildPersonalityPrefix } from '../lib/personalities';
  import type { Test, Question, TestConfig } from '../lib/types';

  // ── Form state ──────────────────────────────────────────────────
  let prompt = $state('');
  let topic = $state('');
  let questionCount = $state(10);
  let mcqPercentage = $state(70);
  let difficulty = $state<'Easy' | 'Medium' | 'Hard'>('Medium');

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
  const canGenerate = $derived(
    !generating && !saving && hasInput && !!settingsStore.settings.apiKey
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
    if (!canGenerate) return;
    apiError = null;
    saveMessage = null;
    savedTestId = null;
    generatedTest = null;
    editableQuestions = [];
    editedTitle = '';
    generating = true;

    // Input validation before making API call
    const promptValidation = validatePrompt(prompt.trim(), selectedFile !== null);
    if (!promptValidation.valid && promptValidation.error) {
      apiError = promptValidation.error.message;
      generating = false;
      return;
    }

    const apiKeyValidation = validateApiKey(settingsStore.settings.apiKey);
    if (!apiKeyValidation.valid && apiKeyValidation.error) {
      apiError = apiKeyValidation.error.message;
      generating = false;
      return;
    }

    // Toggle validation — derived from mcqPercentage until toggle UI is added
    const togglesValidation = validateToggles(mcqPercentage > 0, mcqPercentage < 100);
    if (!togglesValidation.valid && togglesValidation.error) {
      apiError = togglesValidation.error.message;
      generating = false;
      return;
    }

    const config: TestConfig = {
      questionCount: clampCount(questionCount),
      mcqPercentage: clampMcq(mcqPercentage),
      difficulty,
      ...(topic.trim() ? { topic: topic.trim() } : {}),
    };
    const apiKey = settingsStore.settings.apiKey;

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
          personalityPrompt || undefined
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
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        <div class="flex items-baseline justify-between mb-2">
          <label class="micro-label" for="mcq-percentage-slider">MCQ %</label>
          <span class="font-mono text-sm text-foreground">{clampMcq(mcqPercentage)}%</span>
        </div>
        <input
          id="mcq-percentage-slider"
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
    <span class="text-[10px]">{clampCount(questionCount)} Q · {clampMcq(mcqPercentage)}% MCQ · {difficulty}</span>
  </div>

  <button
    type="button"
    onclick={handleGenerate}
    disabled={!canGenerate}
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

  {#if !settingsStore.settings.apiKey}
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
        <button
          type="button"
          onclick={handleReset}
          class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition"
        >
          Discard & start over
        </button>
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
                </div>
              </div>
            {:else}
              <div class="pl-3 border-l-2 border-accent/30">
                <label class="micro-label mb-1.5 block" for={`q-correct-${i}`}>Model Answer</label>
                <textarea
                  id={`q-correct-${i}`}
                  value={question.correctAnswer}
                  oninput={(e) => updateCorrectAnswer(i, (e.currentTarget as HTMLTextAreaElement).value)}
                  rows="3"
                  class="w-full bg-background/30 rounded-md border border-border px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-accent outline-none resize-y"
                ></textarea>
              </div>
            {/if}

            <div>
              <label class="micro-label mb-1.5 block" for={`q-explain-${i}`}>Explanation</label>
              <textarea
                id={`q-explain-${i}`}
                value={question.explanation ?? ''}
                oninput={(e) => updateExplanation(i, (e.currentTarget as HTMLTextAreaElement).value)}
                rows="2"
                class="w-full bg-background/30 rounded-md border border-border px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-accent outline-none resize-y"
              ></textarea>
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
</style>
