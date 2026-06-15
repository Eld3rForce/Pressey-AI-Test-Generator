<script lang="ts">
  import { getAllTests, deleteTest, getAttempts } from '../lib/dbService';
  import type { Test } from '../lib/types';
  import { mapApiError } from '../lib/errorUtils';
  import { Search, ArrowUpDown, Calendar, Hash, Play, FileText, Trash2 } from 'lucide-svelte';

  // ── Types ────────────────────────────────────────────────────────────

  type SortKey =
    | 'date-desc'
    | 'date-asc'
    | 'title-asc'
    | 'title-desc'
    | 'difficulty-asc'
    | 'difficulty-desc';

  interface NavigateParams {
    selectedTestId?: number;
    selectedAttemptId?: number;
    [key: string]: unknown;
  }

  interface Props {
    onNavigate?: (route: string, params?: NavigateParams) => void;
  }

  let { onNavigate }: Props = $props();

  // ── State ────────────────────────────────────────────────────────────

  let tests = $state<Test[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let sortKey = $state<SortKey>('date-desc');
  let showDeleteModal = $state(false);
  let testToDelete = $state<Test | null>(null);
  let deleting = $state(false);
  let cancelButton = $state<HTMLButtonElement | null>(null);

  // ── Lifecycle ────────────────────────────────────────────────────────

  $effect(() => {
    void loadTests();
  });

  // Focus cancel button when modal opens + handle Escape key
  $effect(() => {
    if (showDeleteModal) {
      // Defer to next tick so the element is mounted
      queueMicrotask(() => cancelButton?.focus());

      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !deleting) handleDeleteCancel();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  });

  async function loadTests(): Promise<void> {
    loading = true;
    error = null;
    try {
      tests = await getAllTests();
    } catch (e) {
      error = mapApiError(e);
    } finally {
      loading = false;
    }
  }

  // ── Derived: filtered + sorted list ──────────────────────────────────

  const DIFFICULTY_RANK: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };

  const filteredTests = $derived.by<Test[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = q
      ? tests.filter((t) => {
          const titleHit = t.title.toLowerCase().includes(q);
          const topicHit = t.topic ? t.topic.toLowerCase().includes(q) : false;
          return titleHit || topicHit;
        })
      : tests.slice();

    const sorted = base.slice();
    switch (sortKey) {
      case 'date-desc':
        sorted.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
        break;
      case 'date-asc':
        sorted.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
        break;
      case 'title-asc':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'difficulty-asc':
        sorted.sort(
          (a, b) => (DIFFICULTY_RANK[a.difficulty] ?? 99) - (DIFFICULTY_RANK[b.difficulty] ?? 99),
        );
        break;
      case 'difficulty-desc':
        sorted.sort(
          (a, b) => (DIFFICULTY_RANK[b.difficulty] ?? 0) - (DIFFICULTY_RANK[a.difficulty] ?? 0),
        );
        break;
    }
    return sorted;
  });

  const hasAnyTests = $derived(tests.length > 0);

  // ── Helpers ──────────────────────────────────────────────────────────

  function difficultyTextClass(d: string): string {
    switch (d) {
      case 'Easy':
        return 'text-success';
      case 'Medium':
        return 'text-warning';
      case 'Hard':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  }

  function formatDate(iso?: string): string {
    if (!iso) return 'Unknown date';
    // SQLite "YYYY-MM-DD HH:MM:SS" → treat as UTC
    const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z';
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // ── Action handlers ──────────────────────────────────────────────────

  function handleTakeTest(test: Test): void {
    if (test.id == null) return;
    onNavigate?.('take', { selectedTestId: test.id });
  }

  async function handleReview(test: Test): Promise<void> {
    if (test.id == null) return;
    try {
      const attempts = await getAttempts(test.id);
      const latest = attempts[0];
      onNavigate?.('review', {
        selectedTestId: test.id,
        selectedAttemptId: latest?.id,
      });
    } catch {
      onNavigate?.('review', { selectedTestId: test.id });
    }
  }

  function handleDeleteClick(test: Test): void {
    testToDelete = test;
    showDeleteModal = true;
  }

  function handleDeleteCancel(): void {
    if (deleting) return;
    testToDelete = null;
    showDeleteModal = false;
  }

  async function handleDeleteConfirm(): Promise<void> {
    if (!testToDelete || testToDelete.id == null) return;
    const idToDelete = testToDelete.id;
    deleting = true;
    try {
      await deleteTest(idToDelete);
      // Optimistic local update — remove from in-memory list
      tests = tests.filter((t) => t.id !== idToDelete);
      showDeleteModal = false;
      testToDelete = null;
    } catch (e) {
      error = mapApiError(e);
    } finally {
      deleting = false;
    }
  }

  function handleGenerateCta(): void {
    onNavigate?.('generate');
  }
</script>

<section class="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-0">
  <!-- ── Header ─────────────────────────────────────────────────────── -->
  <header class="space-y-1.5">
    <h1 class="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
      Test History
    </h1>
    <p class="micro-label">Browse, review, and retry your saved tests</p>
  </header>

  <!-- ── Controls ───────────────────────────────────────────────────── -->
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
    <div class="relative flex-1">
      <Search
        size={16}
        class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="search"
        bind:value={searchQuery}
        placeholder="Search by title or topic…"
        aria-label="Search tests"
        class="w-full rounded-lg border border-border bg-background/30 py-2.5 pl-9 pr-4 text-foreground placeholder:text-muted-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent"
      />
    </div>

    <div class="relative">
      <ArrowUpDown
        size={14}
        class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <select
        bind:value={sortKey}
        aria-label="Sort tests"
        class="appearance-none rounded-lg border border-border bg-background/30 py-2.5 pl-8 pr-9 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent cursor-pointer"
      >
        <option value="date-desc">Newest first</option>
        <option value="date-asc">Oldest first</option>
        <option value="title-asc">Title A–Z</option>
        <option value="title-desc">Title Z–A</option>
        <option value="difficulty-asc">Difficulty: Easy → Hard</option>
        <option value="difficulty-desc">Difficulty: Hard → Easy</option>
      </select>
      <span
        aria-hidden="true"
        class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs"
        >▾</span
      >
    </div>
  </div>

  <!-- ── Result counter (only when list is shown) ────────────────────── -->
  {#if !loading && !error && hasAnyTests}
    <p class="micro-label">
      Showing {filteredTests.length} of {tests.length}
      {tests.length === 1 ? 'test' : 'tests'}
    </p>
  {/if}

  <!-- ── Body states ────────────────────────────────────────────────── -->
  {#if loading}
    <div class="surface-card flex items-center justify-center p-12">
      <p class="micro-label animate-pulse">Loading tests…</p>
    </div>
  {:else if error}
    <div class="surface-card space-y-4 p-8 text-center">
      <p class="text-destructive">{error}</p>
      <button
        type="button"
        onclick={loadTests}
        class="rounded-lg border border-border px-4 py-2 text-foreground transition hover:bg-accent/10"
      >
        Retry
      </button>
    </div>
  {:else if !hasAnyTests}
    <!-- Truly empty database -->
    <div class="surface-card space-y-5 p-12 text-center">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary/60">
        <FileText size={24} class="text-muted-foreground" />
      </div>
      <div class="space-y-2">
        <h2 class="font-display text-2xl font-bold text-foreground">No tests yet</h2>
        <p class="mx-auto max-w-sm text-muted-foreground">
          Create your first test to get started. The AI will generate questions on any topic you
          choose.
        </p>
      </div>
      <button
        type="button"
        onclick={handleGenerateCta}
        class="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-semibold text-primary-foreground transition hover:brightness-110"
      >
        <Play size={16} />
        Generate Test
      </button>
    </div>
  {:else if filteredTests.length === 0}
    <!-- No matches for current search -->
    <div class="surface-card space-y-4 p-10 text-center">
      <h2 class="font-display text-xl font-bold text-foreground">No matches</h2>
      <p class="text-muted-foreground">
        No tests match
        <span class="font-medium text-foreground">"{searchQuery}"</span>. Try a different search
        term.
      </p>
      <button
        type="button"
        onclick={() => (searchQuery = '')}
        class="rounded-lg border border-border px-4 py-2 text-foreground transition hover:bg-accent/10"
      >
        Clear search
      </button>
    </div>
  {:else}
    <!-- ── Test list ───────────────────────────────────────────────── -->
    <div class="space-y-3">
      {#each filteredTests as test, i (test.id ?? `${test.title}-${i}`)}
        <article
          class="surface-card group p-5 transition hover:border-accent/40"
          data-testid="test-card"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <!-- Meta column -->
            <div class="min-w-0 flex-1 space-y-3">
              <h3
                class="font-display text-lg font-bold leading-snug text-foreground break-words"
              >
                {test.title}
              </h3>

              <div class="flex flex-wrap items-center gap-2">
                {#if test.topic}
                  <span
                    class="micro-label rounded-md border border-border bg-secondary/60 px-2 py-1"
                  >
                    {test.topic}
                  </span>
                {/if}

                <span
                  class="micro-label rounded-md border border-border bg-secondary/60 px-2 py-1"
                >
                  <span class={difficultyTextClass(test.difficulty)}>
                    {test.difficulty || 'Unknown'}
                  </span>
                </span>

                <span class="micro-label inline-flex items-center gap-1">
                  <Hash size={11} />
                  {test.questionCount}
                  {test.questionCount === 1 ? 'question' : 'questions'}
                </span>

                <span class="micro-label text-muted-foreground/60" aria-hidden="true">·</span>

                <span class="micro-label inline-flex items-center gap-1">
                  <Calendar size={11} />
                  {formatDate(test.createdAt)}
                </span>
              </div>
            </div>

            <!-- Actions column -->
            <div class="flex flex-wrap gap-2 md:shrink-0">
              <button
                type="button"
                onclick={() => handleTakeTest(test)}
                class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:brightness-110"
              >
                <Play size={14} />
                Take Test
              </button>

              <button
                type="button"
                onclick={() => void handleReview(test)}
                class="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-foreground transition hover:bg-accent/10"
              >
                <FileText size={14} />
                Review
              </button>

              <button
                type="button"
                onclick={() => handleDeleteClick(test)}
                aria-label="Delete {test.title}"
                class="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-destructive transition hover:bg-destructive/10"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        </article>

        {#if i < filteredTests.length - 1}
          <hr class="section-divider" aria-hidden="true" />
        {/if}
      {/each}
    </div>
  {/if}
</section>

<!-- ── Delete confirmation modal ──────────────────────────────────────── -->
{#if showDeleteModal && testToDelete}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    onclick={(e) => {
      if (e.target === e.currentTarget) handleDeleteCancel();
    }}
    role="presentation"
  >
    <div
      class="surface-card w-full max-w-md space-y-4 p-6 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      tabindex="-1"
    >
      <div class="space-y-2">
        <div
          class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15"
        >
          <Trash2 size={18} class="text-destructive" />
        </div>
        <h2
          id="delete-modal-title"
          class="font-display text-xl font-bold text-foreground"
        >
          Delete this test?
        </h2>
        <p class="text-sm text-muted-foreground">
          <span class="font-medium text-foreground">"{testToDelete.title}"</span> and all of its
          questions, attempts, and responses will be permanently removed. This cannot be undone.
        </p>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          bind:this={cancelButton}
          onclick={handleDeleteCancel}
          disabled={deleting}
          class="rounded-lg border border-border px-4 py-2 text-foreground transition hover:bg-accent/10 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={() => void handleDeleteConfirm()}
          disabled={deleting}
          class="rounded-lg bg-destructive px-4 py-2 font-medium text-destructive-foreground transition hover:brightness-110 disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
{/if}
