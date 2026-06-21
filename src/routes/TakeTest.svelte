<script lang="ts">
  import {
    getTest,
    createAttempt,
    completeAttempt,
    saveResponses,
    createPartialAttempt,
    getAllTests,
    getAttempts,
  } from '../lib/dbService';
  import { mapApiError } from '../lib/errorUtils';
  import type { Test, Question, Response, Attempt } from '../lib/types';
  import { generateMarking } from '../lib/marking';
  import { settingsStore } from '../lib/settingsStore.svelte';
  import { appStore } from '../lib/appStore.svelte';
  import { Play, CheckCircle2, Circle, History } from 'lucide-svelte';

  // ── Props ─────────────────────────────────────────────────────────────

  interface Props {
    testId: number | null;
    /** Optional per-question time limit in seconds. Enables countdown. */
    timerEnabled?: boolean;
    /** Total test duration in seconds (used when timerEnabled is true). */
    timerSeconds?: number;
    /** Fired after the attempt is persisted. */
    onComplete?: (attemptId: number, score: number, total: number) => void;
    /** Fired when the user wants to see the review screen. */
    onReview?: (attemptId: number) => void;
    /** Fired when the user wants to leave the test screen. */
    onExit?: () => void;
  }

  let {
    testId,
    timerEnabled = false,
    timerSeconds = 0,
    onComplete,
    onReview,
    onExit,
  }: Props = $props();

  // ── State ─────────────────────────────────────────────────────────────

  let test = $state<Test | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  let currentIndex = $state(0);
  let answers = $state(new Map<number, string>());

  let showConfirm = $state(false);
  let showCancelConfirm = $state(false);
  let submitted = $state(false);
  let submitting = $state(false);
  let submitError = $state<string | null>(null);

  let score = $state(0);
  let total = $state(0);
  let attemptId = $state<number | null>(null);

  // Initial value is irrelevant; the timer effect re-syncs from the prop.
  let timeLeft = $state(0);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  // ── Landing state (when testId === null) ────────────────────────────
  let allTests = $state<Test[]>([]);
  let landingLoading = $state(true);
  let attemptsByTest = $state(new Map<number, Attempt[]>());

  // ── Completed-panel state (Bug 2) ───────────────────────────────────
  let showCompletedPanel = $state(false);
  let completedAttempts = $state<Attempt[]>([]);

  // ── Derived ───────────────────────────────────────────────────────────

  let currentQ = $derived<Question | null>(
    test ? (test.questions[currentIndex] ?? null) : null
  );
  let answeredCount = $derived(answers.size);
  let totalCount = $derived(test?.questions.length ?? 0);
  let unansweredCount = $derived(Math.max(0, totalCount - answeredCount));
  let progressPercent = $derived(
    totalCount > 0 ? Math.round(((currentIndex + 1) / totalCount) * 100) : 0
  );
  let percentScore = $derived(total > 0 ? Math.round((score / total) * 100) : 0);
  let showTimerWarning = $derived(
    timerEnabled && timeLeft <= 60 && timeLeft > 0 && !submitted
  );
  let currentAnswer = $derived(
    currentQ?.id != null ? (answers.get(currentQ.id) ?? '') : ''
  );

  // ── Effects ───────────────────────────────────────────────────────────

  $effect(() => {
    // Dispatch to landing or specific test based on testId prop.
    if (testId === null) {
      // Reset all test-specific state when entering landing.
      test = null;
      loadError = null;
      submitted = false;
      showCompletedPanel = false;
      completedAttempts = [];
      void loadLanding();
    } else {
      // Reset landing state when entering a specific test.
      allTests = [];
      attemptsByTest = new Map();
      void loadTest(testId);
    }
  });

  $effect(() => {
    // Start / stop the timer based on lifecycle state.
    if (!timerEnabled || test == null || submitted) {
      return;
    }
    // Reset to configured duration whenever a fresh test loads.
    timeLeft = timerSeconds;
    let current = timeLeft;
    intervalId = setInterval(() => {
      if (current > 0) {
        current -= 1;
        timeLeft = current;
      } else {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    }, 1000);
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  });

  // ── Actions ───────────────────────────────────────────────────────────

  async function loadTest(id: number) {
    loading = true;
    loadError = null;
    submitted = false;
    submitError = null;
    attemptId = null;
    score = 0;
    total = 0;
    currentIndex = 0;
    answers = new Map();
    // Reset completed-panel state (Bug 2)
    showCompletedPanel = false;
    completedAttempts = [];
    try {
      const t = await getTest(id);
      if (!t) {
        loadError = 'Test not found.';
        test = null;
        return;
      }
      test = t;
      total = t.questions.length;

      // ── Bug 2 fix: check for completed attempts ──────────────────
      const attempts = await getAttempts(id);
      const hasInProgress = attempts.some((a) => a.completedAt === undefined);
      const hasCompleted = attempts.some((a) => a.completedAt !== undefined);
      if (hasCompleted && !hasInProgress) {
        showCompletedPanel = true;
        completedAttempts = attempts.filter((a) => a.completedAt !== undefined);
      }
    } catch (e) {
      loadError = mapApiError(e);
      test = null;
    } finally {
      loading = false;
    }
  }

  async function loadLanding() {
    landingLoading = true;
    try {
      const tests = await getAllTests();
      allTests = tests;

      // N+1: fetch attempts per test (matches TestHistory.svelte:70-79 pattern)
      const map = new Map<number, Attempt[]>();
      const fetches = tests
        .filter((t): t is Test & { id: number } => t.id != null)
        .map(async (t) => {
          try {
            const attempts = await getAttempts(t.id);
            return { id: t.id, attempts };
          } catch {
            return { id: t.id, attempts: [] as Attempt[] };
          }
        });
      const results = await Promise.all(fetches);
      for (const r of results) {
        map.set(r.id, r.attempts);
      }
      attemptsByTest = map;
    } catch (e) {
      console.error('Failed to load tests for landing:', e);
      allTests = [];
    } finally {
      landingLoading = false;
    }
  }

  function setAnswer(value: string) {
    if (!currentQ || currentQ.id == null) return;
    const next = new Map(answers);
    if (value === '' || value == null) {
      next.delete(currentQ.id);
    } else {
      next.set(currentQ.id, value);
    }
    answers = next;
  }

  function isMcqCorrect(
    userValue: string,
    correctAnswer: string,
    options: string[]
  ): boolean {
    if (userValue === correctAnswer) return true;
    // Tolerate generators that store the letter (A/B/C/D) instead of the text.
    if (/^[A-D]$/i.test(correctAnswer) && options.length > 0) {
      const idx = correctAnswer.toUpperCase().charCodeAt(0) - 65;
      if (idx >= 0 && idx < options.length) {
        return options[idx] === userValue;
      }
    }
    return false;
  }

  function goTo(index: number) {
    if (!test) return;
    if (index < 0 || index >= test.questions.length) return;
    currentIndex = index;
  }

  function prev() {
    if (currentIndex > 0) currentIndex -= 1;
  }

  function next() {
    if (test && currentIndex < test.questions.length - 1) currentIndex += 1;
  }

  function isAnswered(q: Question): boolean {
    return q.id != null && answers.has(q.id);
  }

  function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }

  function scoreVerdict(pct: number): string {
    if (pct === 100) return 'Perfect score.';
    if (pct >= 80) return 'Outstanding.';
    if (pct >= 60) return 'Great work.';
    if (pct >= 40) return 'Solid effort.';
    return 'Keep practicing.';
  }

  async function handleSubmit() {
    if (!test || test.id == null || submitting) return;
    submitting = true;
    submitError = null;
    showConfirm = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    try {
      const aid = await createAttempt(test.id);
      attemptId = aid;

      // ── AI marking for text questions ──────────────────────────────
      const textQuestions = test.questions.filter((q) => q.type === 'text' && q.id != null);
      let aiMarkings = new Map<number, boolean | null>();
      if (textQuestions.length > 0) {
        try {
          aiMarkings = await generateMarking(
            test,
            answers,
            settingsStore.settings,
            settingsStore.settings.provider,
          );
        } catch (e) {
          console.error('AI marking failed:', e);
          submitError = 'AI marking failed. Please retry.';
          submitting = false;
          return;
        }
      }

      // ── Build responses with the correct marking strategy ──────────
      const responses: Response[] = test.questions
        .filter((q) => q.id != null)
        .map((q) => {
          const ua = answers.get(q.id!);
          let isCorrect = false;
          if (ua != null) {
            if (q.type === 'mcq') {
              isCorrect = isMcqCorrect(ua, q.correctAnswer, q.options ?? []);
            } else {
              const aiResult = aiMarkings.get(q.id!);
              isCorrect = aiResult === true;
            }
          }
          return {
            attemptId: aid,
            questionId: q.id!,
            userAnswer: ua ?? '',
            isCorrect,
          };
        });

      const correct = responses.filter((r) => r.isCorrect).length;
      const t = test.questions.length;

      await saveResponses(responses);
      await completeAttempt(aid, correct, t);

      score = correct;
      total = t;
      submitted = true;
      onComplete?.(aid, correct, t);
    } catch (e) {
      console.error('Submit failed:', e);
      submitError = mapApiError(e);
    } finally {
      submitting = false;
    }
  }

  function handleCancelClick() {
    if (submitting) return;
    showCancelConfirm = true;
  }

  async function handleCancelSave() {
    if (!test || test.id == null) return;
    try {
      await createPartialAttempt(test.id, currentIndex);
      showCancelConfirm = false;
      onExit?.();
    } catch (e) {
      console.error('Cancel save failed:', e);
      // Keep modal open; user can retry
    }
  }

  function handleCancelDiscard() {
    showCancelConfirm = false;
    onExit?.();
  }

  function handleCancelKeepWorking() {
    showCancelConfirm = false;
  }

  function handleModalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      showConfirm = false;
    }
  }
</script>

<main class="studio-bg min-h-screen">
  <div class="page">
    {#if testId === null}
      <!-- ── Landing page (Bug 4) ────────────────────────────────── -->
      <header class="topbar">
        <div class="topbar-text">
          <p class="micro-label">Take Test</p>
          <h1 class="test-title">Choose a test</h1>
        </div>
        <button
          type="button"
          class="btn btn-ghost"
          onclick={() => appStore.navigateTo('history')}
        >
          <History size={14} />
          View all history →
        </button>
      </header>

      {#if landingLoading}
        <div class="state-block surface-card">
          <p class="micro-label">Loading</p>
          <p class="state-title">Loading tests…</p>
        </div>
      {:else if allTests.filter((t) => t.questionCount > 0).length === 0}
        <div class="state-block surface-card">
          <p class="micro-label">Empty</p>
          <p class="state-title">No tests yet</p>
          <p class="state-sub">Generate a test to get started.</p>
        </div>
      {:else}
        <div class="test-list">
          {#each allTests.filter((t) => t.questionCount > 0) as t (t.id)}
            {@const attempts = attemptsByTest.get(t.id ?? -1) ?? []}
            {@const hasInProgress = attempts.some((a) => a.completedAt === undefined)}
            {@const hasCompleted = attempts.some((a) => a.completedAt !== undefined)}
            {@const status = hasInProgress ? 'in-progress' : hasCompleted ? 'completed' : 'new'}
            {@const latestCompleted = attempts.find((a) => a.completedAt !== undefined)}
            <article
              class="surface-card landing-card"
              data-testid="landing-card"
              data-testid-status={status}
            >
              <div class="landing-card-body">
                <h3 class="landing-card-title">{t.title}</h3>
                <div class="landing-meta-row">
                  {#if t.topic}
                    <span class="command-strip">{t.topic}</span>
                  {/if}
                  <span class="command-strip">{t.difficulty || 'Unknown'}</span>
                  <span class="command-strip">
                    {t.questionCount} {t.questionCount === 1 ? 'question' : 'questions'}
                  </span>
                </div>

                <div class="landing-status">
                  {#if status === 'new'}
                    <span class="status-badge status-new" data-testid="status-badge">
                      <Circle size={11} />
                      Not started
                    </span>
                  {:else if status === 'in-progress'}
                    <span class="status-badge status-in-progress" data-testid="status-badge">
                      <Play size={11} />
                      In progress
                    </span>
                  {:else}
                    <span class="status-badge status-completed" data-testid="status-badge">
                      <CheckCircle2 size={11} />
                      Completed
                    </span>
                  {/if}
                </div>
              </div>

              <div class="landing-card-actions">
                {#if status === 'new'}
                  <button
                    type="button"
                    class="btn btn-primary"
                    data-testid="start-test"
                    onclick={() =>
                      t.id != null && appStore.navigateTo('take', { selectedTestId: t.id })}
                  >
                    <Play size={14} />
                    Start Test
                  </button>
                {:else if status === 'in-progress'}
                  <button
                    type="button"
                    class="btn btn-primary"
                    data-testid="resume-test"
                    onclick={() =>
                      t.id != null && appStore.navigateTo('take', { selectedTestId: t.id })}
                  >
                    <Play size={14} />
                    Resume
                  </button>
                {:else}
                  <button
                    type="button"
                    class="btn btn-primary"
                    data-testid="view-results"
                    onclick={() => {
                      if (t.id != null && latestCompleted?.id != null) {
                        appStore.navigateTo('review', {
                          selectedTestId: t.id,
                          selectedAttemptId: latestCompleted.id,
                        });
                      }
                    }}
                  >
                    View Results →
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary"
                    data-testid="retake-test"
                    onclick={() =>
                      t.id != null && appStore.navigateTo('take', { selectedTestId: t.id })}
                  >
                    Retake
                  </button>
                {/if}
              </div>
            </article>
          {/each}
        </div>
      {/if}
    {:else if loading}
      <div class="state-block surface-card">
        <p class="micro-label">Loading</p>
        <p class="state-title">Preparing your test…</p>
      </div>
    {:else if loadError}
      <div class="state-block surface-card">
        <p class="micro-label text-destructive">Error</p>
        <p class="state-title">Failed to load test</p>
        <p class="state-sub">{loadError}</p>
        {#if onExit}
          <button class="btn btn-ghost mt-6" onclick={onExit}>Go back</button>
        {/if}
      </div>
    {:else if showCompletedPanel && test}
      <!-- ── Test already completed panel (Bug 2) ───────────────── -->
      <section class="state-block surface-card">
        <p class="micro-label text-destructive">Already completed</p>
        <p class="state-title">{test.title}</p>
        <p class="state-sub">You've already completed this test.</p>
        <div class="results-actions">
          {#if onExit}
            <button class="btn btn-ghost" onclick={onExit}>Back to tests</button>
          {/if}
          <button
            type="button"
            class="btn btn-primary"
            onclick={() => {
              const latest = completedAttempts[0];
              if (latest?.id != null && test.id != null) {
                appStore.navigateTo('review', {
                  selectedTestId: test.id,
                  selectedAttemptId: latest.id,
                });
              }
            }}
          >
            View Results →
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            onclick={() =>
              test.id != null && appStore.navigateTo('take', { selectedTestId: test.id })}
          >
            Retake
          </button>
        </div>
      </section>
    {:else if !test || test.questions.length === 0}
      <div class="state-block surface-card">
        <p class="micro-label">Empty</p>
        <p class="state-title">This test has no questions yet.</p>
        {#if onExit}
          <button class="btn btn-ghost mt-6" onclick={onExit}>Go back</button>
        {/if}
      </div>
    {:else if !submitted}
      <!-- ── Header ─────────────────────────────────────────────── -->
      <header class="topbar">
        <div class="topbar-text">
          <p class="micro-label">Test in progress</p>
          <h1 class="test-title">{test.title}</h1>
          <div class="meta-row">
            <span class="command-strip">{test.difficulty || 'Mixed'}</span>
            <span class="command-strip">
              Question {currentIndex + 1} of {totalCount}
            </span>
            <span class="command-strip">
              {answeredCount} answered
            </span>
            {#if test.topic}
              <span class="command-strip">{test.topic}</span>
            {/if}
          </div>
        </div>

        {#if timerEnabled}
          <div class="timer" aria-live="polite">
            <span class="timer-label">Time remaining</span>
            <span class="timer-value" class:warning={showTimerWarning}>
              {formatTime(timeLeft)}
            </span>
          </div>
        {/if}

        <button
          class="btn btn-ghost cancel-button"
          onclick={handleCancelClick}
          disabled={submitting}
          aria-label="Cancel test"
        >
          ✕ Cancel
        </button>
      </header>

      <!-- ── Progress bar ────────────────────────────────────────── -->
      <div class="progress-track" aria-hidden="true">
        <div class="progress-fill" style="width: {progressPercent}%;"></div>
      </div>

      {#if showTimerWarning}
        <div class="banner banner-warning" role="status">
          <span class="banner-icon" aria-hidden="true">⚠</span>
          <span>
            Less than 60 seconds left. Submit soon — the test will not auto-submit.
          </span>
        </div>
      {/if}

      {#if submitError}
        <div class="banner banner-error" role="alert">
          <span class="banner-icon" aria-hidden="true">✕</span>
          <span>{submitError}</span>
        </div>
      {/if}

      <!-- ── Question dots ───────────────────────────────────────── -->
      <nav class="dots" aria-label="Question navigation">
        {#each test.questions as q, i (q.id ?? i)}
          <button
            type="button"
            class="dot"
            class:answered={isAnswered(q)}
            class:current={i === currentIndex}
            onclick={() => goTo(i)}
            aria-label="Go to question {i + 1}"
            aria-current={i === currentIndex ? 'true' : undefined}
          >
            {i + 1}
          </button>
        {/each}
      </nav>

      <!-- ── Question card ───────────────────────────────────────── -->
      {#key currentIndex}
        <article class="surface-card question-card">
          <div class="question-header">
            <span class="micro-label">Question {currentIndex + 1}</span>
            <span class="command-strip">
              {currentQ?.type === 'mcq' ? 'Multiple choice' : 'Written answer'}
            </span>
          </div>
          <h2 class="question-text">{currentQ?.text}</h2>

          {#if currentQ?.type === 'mcq' && currentQ.options}
            <div class="options" role="radiogroup" aria-label="Answer options">
              {#each currentQ.options as opt, i (`${currentQ.id}-${i}`)}
                {@const checked = currentAnswer === opt}
                <label class="option" class:selected={checked}>
                  <input
                    type="radio"
                    name="q-{currentQ.id ?? i}"
                    value={opt}
                    checked={checked}
                    onchange={() => setAnswer(opt)}
                  />
                  <span class="option-letter" aria-hidden="true">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span class="option-text">{opt}</span>
                </label>
              {/each}
            </div>
          {:else if currentQ?.type === 'text'}
            <textarea
              class="text-answer"
              value={currentAnswer}
              oninput={(e) => setAnswer(e.currentTarget.value)}
              placeholder="Type your answer here…"
              rows="6"
              spellcheck="false"
            ></textarea>
          {/if}
        </article>
      {/key}

      <!-- ── Footer navigation ──────────────────────────────────── -->
      <footer class="footer">
        <button
          class="btn btn-ghost"
          onclick={prev}
          disabled={currentIndex === 0}
        >
          ← Previous
        </button>

        {#if currentIndex < totalCount - 1}
          <button class="btn btn-secondary" onclick={next}>
            Next →
          </button>
        {:else}
          <button
            class="btn btn-primary"
            onclick={() => (showConfirm = true)}
            disabled={submitting}
          >
            Finish Test
          </button>
        {/if}
      </footer>
    {:else if test}
      <!-- ── Results panel ─────────────────────────────────────── -->
      <section class="results-shell">
        <p class="micro-label">Test complete</p>
        <h1 class="test-title">{test.title}</h1>

        <div class="surface-card results-card">
          <p class="results-eyebrow">Your score</p>
          <p class="score-display">{percentScore}%</p>
          <p class="score-fraction">Score: {score} / {total}</p>
          <p class="score-verdict">{scoreVerdict(percentScore)}</p>

          <div class="results-divider"></div>

          <div class="results-stats">
            <div class="stat">
              <span class="stat-value text-success">{score}</span>
              <span class="stat-label">Correct</span>
            </div>
            <div class="stat">
              <span class="stat-value text-destructive">{total - score}</span>
              <span class="stat-label">Incorrect</span>
            </div>
            <div class="stat">
              <span class="stat-value">{unansweredCount}</span>
              <span class="stat-label">Skipped</span>
            </div>
          </div>

          <div class="results-actions">
            {#if onExit}
              <button class="btn btn-ghost" onclick={onExit}>Done</button>
            {/if}
            <button
              class="btn btn-primary"
              onclick={() => attemptId != null && onReview?.(attemptId)}
              disabled={!onReview || attemptId == null}
            >
              View Review →
            </button>
          </div>
        </div>
      </section>
    {/if}
  </div>
</main>

<!-- ── Confirmation modal ────────────────────────────────────────── -->
{#if showConfirm && test}
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-title"
    tabindex="-1"
    onclick={(e) => e.target === e.currentTarget && (showConfirm = false)}
    onkeydown={handleModalKeydown}
  >
    <div class="surface-card modal">
      <h3 class="modal-title" id="confirm-title">Submit test?</h3>
      <p class="modal-text">
        You have answered
        <strong class="text-foreground">{answeredCount}</strong>
        of
        <strong class="text-foreground">{totalCount}</strong>
        questions.
      </p>
      {#if unansweredCount > 0}
        <p class="modal-warning">
          ⚠ {unansweredCount}
          unanswered question{unansweredCount === 1 ? '' : 's'} will be marked
          incorrect.
        </p>
      {/if}
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick={() => (showConfirm = false)}>
          Keep working
        </button>
        <button
          class="btn btn-primary"
          onclick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Submitting…' : 'Submit test'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Cancel confirmation modal (3-option) ────────────────────── -->
{#if showCancelConfirm}
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="cancel-title"
    tabindex="-1"
    onclick={(e) => e.target === e.currentTarget && (showCancelConfirm = false)}
    onkeydown={(e) => e.key === 'Escape' && (showCancelConfirm = false)}
  >
    <div class="surface-card modal">
      <h3 class="modal-title" id="cancel-title">Cancel test?</h3>
      <p class="modal-text">
        Your progress will be lost unless you save it. You can resume a saved test from the Take Test page.
      </p>
      <div class="modal-actions modal-actions-3">
        <button class="btn btn-ghost" onclick={handleCancelKeepWorking}>
          Keep working
        </button>
        <button class="btn btn-destructive" onclick={handleCancelDiscard}>
          Discard &amp; exit
        </button>
        <button class="btn btn-primary" onclick={handleCancelSave}>
          Save &amp; exit
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page {
    max-width: 56rem;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 4rem;
  }

  /* ── States (loading / error / empty) ──────────────────────── */
  .state-block {
    margin: 4rem auto 0;
    max-width: 28rem;
    padding: 2.5rem 2rem;
    text-align: center;
  }
  .state-title {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-foreground);
    margin: 0.5rem 0 0;
  }
  .state-sub {
    color: var(--color-muted-foreground);
    margin: 0.5rem 0 0;
  }

  /* ── Header / topbar ──────────────────────────────────────── */
  .topbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }
  .topbar-text {
    flex: 1;
    min-width: 0;
  }
  .test-title {
    font-family: var(--font-display);
    font-size: 1.875rem;
    font-weight: 700;
    color: var(--color-foreground);
    line-height: 1.2;
    margin: 0.25rem 0 0;
  }
  .meta-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  /* ── Timer ────────────────────────────────────────────────── */
  .timer {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    flex-shrink: 0;
    padding: 0.75rem 1.25rem;
    background-color: oklch(0.18 0.02 280 / 60%);
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .timer-label {
    font-family: var(--font-mono);
    font-size: 0.625rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-muted-foreground);
  }
  .timer-value {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-foreground);
    letter-spacing: 0.05em;
    line-height: 1.1;
    margin-top: 0.25rem;
    transition: color 200ms;
  }
  .timer-value.warning {
    color: var(--color-destructive);
    animation: pulse 1s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.55;
    }
  }

  /* ── Progress bar ─────────────────────────────────────────── */
  .progress-track {
    width: 100%;
    height: 0.375rem;
    background-color: var(--color-muted);
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: 1.5rem;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--color-primary) 0%,
      var(--color-accent) 100%
    );
    border-radius: 999px;
    transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 12px oklch(0.82 0.14 85 / 0.45);
  }

  /* ── Banners ──────────────────────────────────────────────── */
  .banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }
  .banner-warning {
    background-color: oklch(0.62 0.18 15 / 0.1);
    border: 1px solid var(--color-destructive);
    color: var(--color-destructive);
  }
  .banner-error {
    background-color: oklch(0.62 0.18 15 / 0.1);
    border: 1px solid var(--color-destructive);
    color: var(--color-destructive);
  }
  .banner-icon {
    flex-shrink: 0;
    font-size: 1rem;
  }

  /* ── Question dots ────────────────────────────────────────── */
  .dots {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }
  .dot {
    width: 2.25rem;
    height: 2.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-muted-foreground);
    background-color: var(--color-muted);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 180ms;
  }
  .dot:hover:not(.current) {
    background-color: var(--color-secondary);
    color: var(--color-foreground);
    transform: translateY(-1px);
  }
  .dot.answered {
    background-color: var(--color-primary);
    color: var(--color-primary-foreground);
    border-color: var(--color-primary);
  }
  .dot.current {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px oklch(0.72 0.1 195 / 0.18);
  }

  /* ── Question card ────────────────────────────────────────── */
  .question-card {
    padding: 2.5rem;
    margin-bottom: 1.5rem;
    position: relative;
    overflow: hidden;
    animation: questionIn 350ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .question-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--color-primary) 50%,
      transparent 100%
    );
    opacity: 0.6;
  }
  .question-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
  .question-text {
    font-family: var(--font-display);
    font-size: 1.25rem;
    line-height: 1.55;
    color: var(--color-foreground);
    margin: 0.5rem 0 2rem;
    white-space: pre-wrap;
  }
  @keyframes questionIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ── MCQ options ──────────────────────────────────────────── */
  .options {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .option {
    position: relative;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background-color: var(--color-muted);
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
    cursor: pointer;
    transition:
      background-color 180ms,
      border-color 180ms,
      transform 180ms;
  }
  .option:hover {
    background-color: var(--color-secondary);
    border-color: oklch(0.72 0.1 195 / 0.6);
    transform: translateX(3px);
  }
  .option.selected {
    background-color: oklch(0.82 0.14 85 / 0.14);
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
  }
  .option input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
  }
  .option-letter {
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-foreground);
    background-color: oklch(0.16 0.02 280 / 90%);
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    transition: all 180ms;
  }
  .option.selected .option-letter {
    background-color: var(--color-primary);
    color: var(--color-primary-foreground);
    border-color: var(--color-primary);
  }
  .option-text {
    flex: 1;
    line-height: 1.5;
    color: var(--color-foreground);
  }

  /* ── Text answer ──────────────────────────────────────────── */
  .text-answer {
    width: 100%;
    min-height: 11rem;
    padding: 1rem 1.25rem;
    background-color: oklch(0.16 0.02 280 / 90%);
    border: 1px solid var(--color-border);
    border-radius: 0.625rem;
    color: var(--color-foreground);
    font-family: var(--font-mono);
    font-size: 0.9375rem;
    line-height: 1.6;
    resize: vertical;
    transition:
      border-color 180ms,
      box-shadow 180ms;
  }
  .text-answer:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px oklch(0.72 0.1 195 / 0.25);
  }
  .text-answer::placeholder {
    color: var(--color-muted-foreground);
  }

  /* ── Footer ───────────────────────────────────────────────── */
  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  /* ── Buttons ──────────────────────────────────────────────── */
  .btn {
    padding: 0.75rem 1.5rem;
    border-radius: 0.625rem;
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 180ms;
    border: 1px solid var(--color-border);
    white-space: nowrap;
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .btn-ghost {
    background-color: transparent;
    color: var(--color-muted-foreground);
  }
  .btn-ghost:hover:not(:disabled) {
    background-color: var(--color-secondary);
    color: var(--color-foreground);
  }
  .btn-secondary {
    background-color: var(--color-secondary);
    color: var(--color-foreground);
  }
  .btn-secondary:hover:not(:disabled) {
    background-color: var(--color-muted);
    transform: translateY(-1px);
  }
  .btn-primary {
    background-color: var(--color-primary);
    color: var(--color-primary-foreground);
    border-color: var(--color-primary);
    font-weight: 600;
  }
  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.08);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px oklch(0.82 0.14 85 / 0.25);
  }

  /* ── Modal ────────────────────────────────────────────────── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: oklch(0.14 0.018 280 / 75%);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    animation: fadeIn 200ms ease;
    padding: 1rem;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  .modal {
    max-width: 28rem;
    width: 100%;
    padding: 2rem;
    animation: scaleIn 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes scaleIn {
    from {
      transform: scale(0.94);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
  .modal-title {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-foreground);
    margin: 0 0 0.5rem;
  }
  .modal-text {
    color: var(--color-muted-foreground);
    line-height: 1.55;
    margin: 0 0 1rem;
  }
  .modal-warning {
    color: var(--color-warning);
    font-size: 0.875rem;
    margin: 0 0 1.5rem;
    padding: 0.75rem 1rem;
    background-color: oklch(0.8 0.15 75 / 0.1);
    border: 1px solid var(--color-warning);
    border-radius: 0.5rem;
    line-height: 1.5;
  }
  .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }
  .modal-actions-3 {
    flex-wrap: wrap;
  }
  .cancel-button {
    align-self: flex-start;
    flex-shrink: 0;
  }
  .btn-destructive {
    background-color: var(--color-destructive);
    color: var(--color-destructive-foreground);
    border-color: var(--color-destructive);
    font-weight: 500;
  }
  .btn-destructive:hover:not(:disabled) {
    filter: brightness(1.08);
    transform: translateY(-1px);
  }

  /* ── Results panel ────────────────────────────────────────── */
  .results-shell {
    max-width: 36rem;
    margin: 0 auto;
    text-align: center;
    padding-top: 2rem;
  }
  .results-shell .test-title {
    margin: 0.25rem 0 2rem;
  }
  .results-card {
    padding: 3rem 2.5rem 2.5rem;
    position: relative;
    overflow: hidden;
    animation: questionIn 350ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .results-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--color-primary) 50%,
      transparent 100%
    );
    opacity: 0.8;
  }
  .results-eyebrow {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-muted-foreground);
    margin: 0 0 0.5rem;
  }
  .score-display {
    font-family: var(--font-display);
    font-size: 4rem;
    font-weight: 800;
    background: linear-gradient(
      135deg,
      var(--color-primary) 0%,
      var(--color-accent) 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    line-height: 1;
    margin: 0 0 0.75rem;
  }
  .score-fraction {
    font-family: var(--font-mono);
    font-size: 1.125rem;
    color: var(--color-foreground);
    margin: 0;
  }
  .score-verdict {
    color: var(--color-muted-foreground);
    font-size: 0.9375rem;
    margin: 0.5rem 0 1.5rem;
  }
  .results-divider {
    height: 1px;
    background: linear-gradient(
      to right,
      transparent 0%,
      var(--color-border) 50%,
      transparent 100%
    );
    margin: 1.5rem 0;
  }
  .results-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.75rem 0.5rem;
    background-color: oklch(0.18 0.02 280 / 60%);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
  }
  .stat-value {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-foreground);
  }
  .stat-label {
    font-family: var(--font-mono);
    font-size: 0.625rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-muted-foreground);
  }
  .results-actions {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
  }

  /* ── Landing page ────────────────────────────────────────── */
  .test-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .landing-card {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    transition: border-color 180ms;
  }
  .landing-card:hover {
    border-color: oklch(0.72 0.1 195 / 0.6);
  }
  .landing-card-body {
    min-width: 0;
  }
  .landing-card-title {
    font-family: var(--font-display);
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-foreground);
    line-height: 1.3;
    margin: 0 0 0.75rem;
    word-break: break-word;
  }
  .landing-meta-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .landing-status {
    display: flex;
    align-items: center;
  }
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 600;
    border: 1px solid var(--color-border);
  }
  .status-new {
    background-color: oklch(0.18 0.02 280 / 60%);
    color: var(--color-muted-foreground);
  }
  .status-in-progress {
    background-color: oklch(0.72 0.1 195 / 0.15);
    color: oklch(0.78 0.12 195);
    border-color: oklch(0.72 0.1 195 / 0.4);
  }
  .status-completed {
    background-color: oklch(0.7 0.15 145 / 0.15);
    color: oklch(0.78 0.15 145);
    border-color: oklch(0.7 0.15 145 / 0.4);
  }
  .landing-card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .landing-card-actions .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  /* ── Responsive ───────────────────────────────────────────── */
  @media (max-width: 640px) {
    .page {
      padding: 1.5rem 1rem 3rem;
    }
    .test-title {
      font-size: 1.5rem;
    }
    .question-card {
      padding: 1.5rem;
    }
    .question-text {
      font-size: 1.125rem;
    }
    .score-display {
      font-size: 3rem;
    }
    .topbar {
      flex-direction: column;
    }
    .timer {
      align-self: flex-start;
    }
    .landing-card {
      padding: 1.25rem;
    }
  }
</style>
