<script lang="ts">
  import { exportTestToPdf } from '../lib/pdfExport';
  import { getTest, getAttempt, getResponses, saveExplanations, getExplanations, getSettings } from '../lib/dbService';
  import { generateExplanations } from '../lib/explanations';
  import { mapApiError } from '../lib/errorUtils';
  import type { Test, Attempt, Response, Question, Explanation } from '../lib/types';

  // ── Props ──────────────────────────────────────────────────────────────

  type Filter = 'all' | 'correct' | 'incorrect';

  let {
    testId,
    attemptId,
    onRetake = (_testId: number) => {},
    onClose = () => {},
  }: {
    testId: number;
    attemptId: number;
    onRetake?: (testId: number) => void;
    onClose?: () => void;
  } = $props();

  // ── State ──────────────────────────────────────────────────────────────

  let test = $state<Test | null>(null);
  let attempt = $state<Attempt | null>(null);
  let responses = $state<Response[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  let filter = $state<Filter>('all');
  let exporting = $state(false);
  let exportError = $state<string | null>(null);

  let explanations = $state<Explanation[]>([]);
  let explanationsLoading = $state(false);
  let explanationsError = $state<string | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────

  /** Map of questionId → response for fast lookup. */
  let responseByQuestion = $derived(new Map(responses.map((r) => [r.questionId, r])));

  /** Number of correct responses in this attempt. */
  let correctCount = $derived(responses.filter((r) => r.isCorrect).length);

  /** Total questions in the test. */
  let totalQuestions = $derived(test?.questions.length ?? attempt?.totalQuestions ?? 0);

  /** Score as an integer percentage 0-100. */
  let scorePercent = $derived(
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
  );

  /** Color band for the score: success / warning / destructive. */
  let scoreBand = $derived<'success' | 'warning' | 'destructive'>(
    scorePercent >= 70 ? 'success' : scorePercent >= 50 ? 'warning' : 'destructive',
  );

  /** Tailwind classes for the large score number. */
  let scoreClass = $derived(
    scoreBand === 'success'
      ? 'text-success'
      : scoreBand === 'warning'
        ? 'text-warning'
        : 'text-destructive',
  );

  /** Background ring color (soft tinted halo behind the big number). */
  let scoreHaloClass = $derived(
    scoreBand === 'success'
      ? 'bg-success/10 ring-success/20'
      : scoreBand === 'warning'
        ? 'bg-warning/10 ring-warning/20'
        : 'bg-destructive/10 ring-destructive/20',
  );

  /** Formatted attempt date for the header. */
  let attemptDate = $derived(formatDate(attempt?.completedAt ?? attempt?.startedAt));

  /** Review entry combining a question with the user's response. */
  interface ReviewEntry {
    index: number;
    question: Question;
    response: Response | undefined;
    isCorrect: boolean;
  }

  let reviewEntries = $derived<ReviewEntry[]>(
    (test?.questions ?? []).map((q, i) => {
      const r = q.id !== undefined ? responseByQuestion.get(q.id) : undefined;
      return {
        index: i + 1,
        question: q,
        response: r,
        isCorrect: r?.isCorrect ?? false,
      };
    }),
  );

  /** Filtered list driven by the tab control. */
  let visibleEntries = $derived(
    filter === 'all'
      ? reviewEntries
      : filter === 'correct'
        ? reviewEntries.filter((e) => e.isCorrect)
        : reviewEntries.filter((e) => !e.isCorrect),
  );

  let correctCountLabel = $derived(`${correctCount}/${totalQuestions} correct`);

  let filterTabs: { id: Filter; label: string; count: number }[] = $derived([
    { id: 'all', label: 'All', count: reviewEntries.length },
    { id: 'correct', label: 'Correct', count: reviewEntries.filter((e) => e.isCorrect).length },
    {
      id: 'incorrect',
      label: 'Incorrect',
      count: reviewEntries.filter((e) => !e.isCorrect).length,
    },
  ]);

  // ── Effects ────────────────────────────────────────────────────────────

  $effect(() => {
    // Track the IDs so the effect re-runs if the parent swaps tests.
    const tId = testId;
    const aId = attemptId;
    void loadReview(tId, aId);
  });

  // ── Data loading ───────────────────────────────────────────────────────

  async function loadReview(tId: number, aId: number) {
    loading = true;
    loadError = null;
    try {
      const [t, a, r] = await Promise.all([getTest(tId), getAttempt(aId), getResponses(aId)]);
      if (!t) {
        loadError = `Test #${tId} could not be found.`;
        test = null;
        attempt = a;
        responses = r;
        return;
      }
      test = t;
      attempt = a;
      responses = r;
    } catch (err) {
      loadError = mapApiError(err);
      console.error('TestReview load failed:', err);
    } finally {
      loading = false;
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────

  function handleRetake() {
    if (test?.id !== undefined) onRetake(test.id);
  }

  async function handleExportPdf() {
    if (!test || exporting) return;
    exporting = true;
    exportError = null;
    try {
      const bytes = await exportTestToPdf(test, true);
      triggerDownload(bytes, sanitiseFilename(`${test.title}-review.pdf`));
    } catch (err) {
      exportError = err instanceof Error ? err.message : 'PDF export failed.';
      console.error('PDF export failed:', err);
    } finally {
      exporting = false;
    }
  }

  async function handleGetExplanations() {
    if (!test || !attempt || explanationsLoading) return;

    const existingExplanations = await getExplanations(attemptId);
    if (existingExplanations.length > 0) {
      explanations = existingExplanations;
      return;
    }

    explanationsLoading = true;
    explanationsError = null;
    try {
      const settings = await getSettings();
      if (!settings.apiKey) {
        explanationsError = 'API key not configured. Add your OpenRouter API key in Settings.';
        return;
      }

      const generated = await generateExplanations(attempt, test, settings.apiKey, settings.model);
      if (generated.length > 0) {
        await saveExplanations(generated);
      }
      explanations = generated;
    } catch (err) {
      explanationsError = err instanceof Error ? err.message : 'Failed to generate explanations.';
      console.error('Explanation generation failed:', err);
    } finally {
      explanationsLoading = false;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  function formatDate(input?: string): string {
    if (!input) return '—';
    try {
      return new Date(input).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return input;
    }
  }

  function sanitiseFilename(name: string): string {
    return name.replace(/[^a-z0-9-_]+/gi, '_').replace(/_+/g, '_');
  }

  function triggerDownload(bytes: Uint8Array, filename: string) {
    // Copy into a fresh ArrayBuffer so the Blob constructor sees a clean
    // ArrayBuffer (not a SharedArrayBuffer view).
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke after a short delay so the browser has time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** For MCQ questions the stored correctAnswer is the option text. */
  function formatAnswer(question: Question, answer: string): string {
    if (question.type === 'mcq' && question.options && question.options.length > 0) {
      const idx = question.options.indexOf(answer);
      if (idx >= 0) {
        const letter = String.fromCharCode(65 + idx);
        return `${letter}. ${answer}`;
      }
    }
    return answer || '— no answer —';
  }

  function questionTypeLabel(t: Question['type']): string {
    return t === 'mcq' ? 'Multiple Choice' : 'Written';
  }
</script>

<section class="studio-bg min-h-screen px-4 py-8 sm:px-6 lg:px-10">
  <div class="mx-auto w-full max-w-4xl space-y-8">
    <!-- ── Top bar ─────────────────────────────────────────────────── -->
    <header class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <span class="command-strip">REVIEW MODE</span>
        <span class="micro-label">Test #{testId} · Attempt #{attemptId}</span>
      </div>
      <button
        type="button"
        onclick={onClose}
        class="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent/10 transition"
        aria-label="Close review"
      >
        Close
      </button>
    </header>

    {#if loading}
      <div class="surface-card p-12 text-center">
        <p class="micro-label mb-2">Loading</p>
        <p class="font-display text-xl text-foreground">Preparing your review…</p>
      </div>
    {:else if loadError}
      <div class="surface-card p-8 border border-destructive/40">
        <p class="micro-label text-destructive mb-2">Error</p>
        <p class="text-foreground">{loadError}</p>
      </div>
    {:else if test}
      <!-- ── Score header ──────────────────────────────────────────── -->
      <div class="surface-card relative overflow-hidden p-6 sm:p-8">
        <div
          class="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl"
          aria-hidden="true"
        ></div>
        <div
          class="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-accent/5 blur-3xl"
          aria-hidden="true"
        ></div>

        <div class="relative grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div
            class={`flex h-32 w-32 shrink-0 items-center justify-center rounded-full ring-8 ${scoreHaloClass} ${scoreClass}`}
          >
            <div class="text-center leading-none">
              <div class="font-display text-5xl font-bold tracking-tight">
                {scorePercent}<span class="text-2xl">%</span>
              </div>
              <div class="micro-label mt-1 opacity-80">{correctCountLabel}</div>
            </div>
          </div>

          <div class="space-y-2">
            <p class="micro-label">Test Review</p>
            <h1 class="font-display text-3xl font-bold text-foreground sm:text-4xl">
              {test.title}
            </h1>
            <p class="text-muted-foreground">
              {#if test.topic}
                <span class="text-foreground/80">{test.topic}</span>
                <span class="px-2 text-border">·</span>
              {/if}
              <span>{test.difficulty}</span>
              <span class="px-2 text-border">·</span>
              <span>Completed {attemptDate}</span>
            </p>
          </div>
        </div>
      </div>

      <!-- ── Filter tabs ──────────────────────────────────────────── -->
      <div class="surface-card p-2">
        <div role="tablist" aria-label="Filter questions" class="flex gap-1">
          {#each filterTabs as tab (tab.id)}
            <button
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              onclick={() => (filter = tab.id)}
              class={[
                'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition',
                filter === tab.id
                  ? 'bg-accent/15 text-foreground ring-1 ring-accent/30'
                  : 'text-muted-foreground hover:bg-accent/5 hover:text-foreground',
              ].join(' ')}
            >
              <span>{tab.label}</span>
              <span
                class={`ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs ${filter === tab.id ? 'bg-foreground/10' : 'bg-background/40'}`}
              >
                {tab.count}
              </span>
            </button>
          {/each}
        </div>
      </div>

      <!-- ── Question list ────────────────────────────────────────── -->
      {#if visibleEntries.length === 0}
        <div class="surface-card p-10 text-center">
          <p class="micro-label mb-2">Nothing here</p>
          <p class="font-display text-lg text-foreground">
            {filter === 'correct'
              ? 'No correct answers to show — yet.'
              : filter === 'incorrect'
                ? 'No incorrect answers — nice work.'
                : 'This attempt has no questions.'}
          </p>
        </div>
      {:else}
        <ol class="space-y-4">
          {#each visibleEntries as entry (entry.question.id ?? entry.index)}
            {@const isCorrect = entry.isCorrect}
            <li class="surface-card p-5 sm:p-6">
              <div class="flex flex-wrap items-center gap-2">
                <span class="micro-label">Question {entry.index}</span>
                <span class="command-strip">{questionTypeLabel(entry.question.type)}</span>
                <span class="ml-auto">
                  {#if isCorrect}
                    <span
                      class="micro-label inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-success"
                    >
                      <span aria-hidden="true">✓</span> Correct
                    </span>
                  {:else}
                    <span
                      class="micro-label inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-destructive"
                    >
                      <span aria-hidden="true">✗</span>
                      {entry.response ? 'Incorrect' : 'Skipped'}
                    </span>
                  {/if}
                </span>
              </div>

              <p class="mt-3 font-display text-lg text-foreground sm:text-xl">
                {entry.question.text}
              </p>

              <div class="mt-4 grid gap-3 sm:grid-cols-2">
                <div
                  class={[
                    'rounded-lg border p-3',
                    isCorrect
                      ? 'border-success/30 bg-success/10'
                      : 'border-destructive/30 bg-destructive/10',
                  ].join(' ')}
                >
                  <p class="micro-label mb-1">
                    {isCorrect ? 'Your answer' : 'Your answer'}
                  </p>
                  <p
                    class={[
                      'text-sm sm:text-base',
                      isCorrect ? 'text-success' : 'text-destructive',
                    ].join(' ')}
                  >
                    {entry.response
                      ? formatAnswer(entry.question, entry.response.userAnswer)
                      : '— skipped —'}
                  </p>
                </div>

                <div class="rounded-lg border border-border bg-background/30 p-3">
                  <p class="micro-label mb-1">Correct answer</p>
                  <p class="text-sm text-foreground sm:text-base">
                    {formatAnswer(entry.question, entry.question.correctAnswer)}
                  </p>
                </div>
              </div>

              {#if entry.question.explanation}
                <div class="mt-3 rounded-lg border border-border bg-background/20 p-3">
                  <p class="micro-label mb-1">Explanation</p>
                  <p class="text-sm leading-relaxed text-muted-foreground">
                    {entry.question.explanation}
                  </p>
                </div>
              {/if}
            </li>
          {/each}
        </ol>
      {/if}

      <!-- ── AI Explanations ─────────────────────────────────────── -->
      {#if reviewEntries.filter((e) => !e.isCorrect).length > 0}
        <div class="surface-card p-5 sm:p-6 space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="micro-label">AI Explanations</p>
              <p class="text-sm text-muted-foreground">
                Get personalised explanations for your incorrect answers with learning resources.
              </p>
            </div>
            {#if explanations.length === 0}
              <button
                type="button"
                onclick={handleGetExplanations}
                disabled={explanationsLoading}
                class="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:brightness-110 disabled:opacity-50 transition"
              >
                {explanationsLoading ? 'Generating…' : 'Get AI Explanations'}
              </button>
            {/if}
          </div>

          {#if explanationsLoading}
            <div class="flex items-center gap-3 rounded-lg border border-border bg-background/20 p-4">
              <div class="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden="true"></div>
              <p class="text-sm text-muted-foreground">Generating AI explanations for your incorrect answers…</p>
            </div>
          {/if}

          {#if explanationsError}
            <div class="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <p class="text-sm text-destructive">{explanationsError}</p>
            </div>
          {/if}

          {#each explanations as exp (exp.questionId)}
            {@const entry = reviewEntries.find((e) => e.question.id === exp.questionId)}
            <div class="rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-3">
              {#if entry}
                <p class="font-display text-base text-foreground">{entry.question.text}</p>
              {/if}

              <div class="rounded-lg border border-border bg-background/30 p-3">
                <p class="micro-label mb-1">Explanation</p>
                <p class="text-sm leading-relaxed text-foreground">{exp.explanation}</p>
              </div>

              <div class="rounded-lg border border-border bg-background/20 p-3">
                <p class="micro-label mb-1">What you got wrong</p>
                <p class="text-sm leading-relaxed text-muted-foreground">{exp.userMistake}</p>
              </div>

              {#if exp.resources.length > 0}
                <div class="rounded-lg border border-border bg-background/20 p-3">
                  <p class="micro-label mb-2">Learning Resources</p>
                  <ul class="space-y-2">
                    {#each exp.resources as resource}
                      <li>
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                        >
                          <span class="micro-label rounded bg-accent/10 px-1.5 py-0.5 text-xs">{resource.type}</span>
                          {resource.title}
                        </a>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- ── Actions ──────────────────────────────────────────────── -->
      <div class="surface-card p-4 sm:p-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="space-y-1">
            <p class="micro-label">Done reviewing?</p>
            <p class="text-sm text-muted-foreground">
              Export a PDF for your records, or jump back in and try again.
            </p>
            {#if exportError}
              <p class="text-sm text-destructive">{exportError}</p>
            {/if}
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <button
              type="button"
              onclick={handleExportPdf}
              disabled={exporting}
              class="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent/10 disabled:opacity-50 transition"
            >
              {exporting ? 'Exporting PDF…' : 'Export to PDF'}
            </button>
            <button
              type="button"
              onclick={handleRetake}
              class="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110 transition"
            >
              Retake Test
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</section>
