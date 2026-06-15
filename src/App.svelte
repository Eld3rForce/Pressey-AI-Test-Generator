<script lang="ts">
  import Layout from './components/Layout.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import ErrorBoundary from './components/ErrorBoundary.svelte';
  import LoadingOverlay from './components/LoadingOverlay.svelte';
  import GenerateTest from './routes/GenerateTest.svelte';
  import TakeTest from './routes/TakeTest.svelte';
  import TestHistory from './routes/TestHistory.svelte';
  import TestReview from './routes/TestReview.svelte';
  import Settings from './routes/Settings.svelte';
  import FileQuestion from 'lucide-svelte/icons/file-question';
  import Play from 'lucide-svelte/icons/play';
  import History from 'lucide-svelte/icons/history';
  import SettingsIcon from 'lucide-svelte/icons/settings';
  import Search from 'lucide-svelte/icons/search';

  import { type RouteId, appStore } from './lib/appStore.svelte';

  // ── Route metadata (header display) ────────────────────────────

  interface RouteMeta {
    title: string;
    eyebrow: string;
    description: string;
    icon: typeof FileQuestion;
  }

  const routes: Record<Exclude<RouteId, 'review'>, RouteMeta> = {
    generate: {
      title: 'Generate Test',
      eyebrow: 'Author',
      description: 'Upload source material and let the model draft questions, mix MCQ and free-response, and tune difficulty.',
      icon: FileQuestion,
    },
    take: {
      title: 'Take Test',
      eyebrow: 'Run',
      description: 'Pick a generated test, set a timer, and work through it. Answers and timing are captured locally.',
      icon: Play,
    },
    history: {
      title: 'Test History',
      eyebrow: 'Review',
      description: 'Browse past runs, scores, and per-question results. Export to PDF or revisit a test for review.',
      icon: History,
    },
    settings: {
      title: 'Settings',
      eyebrow: 'Configure',
      description: 'Manage your OpenRouter API key, default model, question counts, MCQ mix, and difficulty.',
      icon: SettingsIcon,
    },
  };

  // ── Derived ────────────────────────────────────────────────────

  const isReviewRoute = $derived(appStore.activeRoute === 'review');
  const currentMeta = $derived(
    isReviewRoute ? null : routes[appStore.activeRoute as Exclude<RouteId, 'review'>],
  );
  const CurrentIcon = $derived(currentMeta?.icon);

  // ── Sidebar navigation ─────────────────────────────────────────

  function handleSidebarNavigate(route: 'generate' | 'take' | 'history' | 'settings'): void {
    appStore.navigateTo(route);
  }

  // Map to Sidebar's narrow type — review maps to history for highlight purposes.
  const sidebarRoute = $derived<'generate' | 'take' | 'history' | 'settings'>(
    appStore.activeRoute === 'review' ? 'history' : appStore.activeRoute,
  );

  // ── Route callbacks ────────────────────────────────────────────

  function handleReviewAttempt(attemptId: number): void {
    appStore.navigateTo('review', { selectedAttemptId: attemptId });
  }

  function handleExitTake(): void {
    appStore.navigateTo('history');
  }

  function handleRetakeTest(testId: number): void {
    appStore.navigateTo('take', { selectedTestId: testId });
  }

  function handleCloseReview(): void {
    appStore.navigateTo('history');
  }
</script>

<Layout>
  {#snippet children()}
    <Sidebar activeRoute={sidebarRoute} onnavigate={handleSidebarNavigate} />

    <main class="flex-1 overflow-y-auto">
      <div class="mx-auto flex h-full max-w-5xl flex-col gap-8 px-10 py-10">
        <!-- Route header (hidden on review screens) -->
        {#if currentMeta && CurrentIcon}
          <header class="flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <div
                class="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30"
                aria-hidden="true"
              >
                <CurrentIcon size={20} strokeWidth="2.25" />
              </div>
              <div class="flex flex-col leading-tight">
                <span class="micro-label">{currentMeta.eyebrow}</span>
                <h1 class="font-display text-2xl font-bold tracking-tight text-foreground">
                  {currentMeta.title}
                </h1>
              </div>
            </div>
            <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {currentMeta.description}
            </p>
          </header>

          <hr class="section-divider m-0" />
        {/if}

        <!-- Route body -->
        <section class="flex-1">
          <ErrorBoundary>
            {#if appStore.activeRoute === 'generate'}
              <GenerateTest />

            {:else if appStore.activeRoute === 'take'}
              {#if appStore.selectedTestId !== null}
                <TakeTest
                  testId={appStore.selectedTestId}
                  onReview={handleReviewAttempt}
                  onExit={handleExitTake}
                />
              {:else}
                <div class="surface-card space-y-4 p-12 text-center">
                  <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary/60">
                    <Search size={24} class="text-muted-foreground" />
                  </div>
                  <div class="space-y-2">
                    <h2 class="font-display text-2xl font-bold text-foreground">No test selected</h2>
                    <p class="mx-auto max-w-sm text-muted-foreground">
                      Browse your Test History to pick a test, or generate a new one first.
                    </p>
                  </div>
                  <button
                    type="button"
                    onclick={() => appStore.navigateTo('history')}
                    class="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-semibold text-primary-foreground transition hover:brightness-110"
                  >
                    <History size={16} />
                    Go to History
                  </button>
                </div>
              {/if}

            {:else if appStore.activeRoute === 'history'}
              <TestHistory onNavigate={(route, params) => appStore.navigateTo(route as RouteId, params)} />

            {:else if appStore.activeRoute === 'review'}
              {#if appStore.selectedTestId !== null && appStore.selectedAttemptId !== null}
                <TestReview
                  testId={appStore.selectedTestId}
                  attemptId={appStore.selectedAttemptId}
                  onRetake={handleRetakeTest}
                  onClose={handleCloseReview}
                />
              {:else}
                <div class="surface-card space-y-4 p-12 text-center">
                  <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary/60">
                    <Search size={24} class="text-muted-foreground" />
                  </div>
                  <div class="space-y-2">
                    <h2 class="font-display text-2xl font-bold text-foreground">Cannot load review</h2>
                    <p class="mx-auto max-w-sm text-muted-foreground">
                      No test or attempt selected. Go back to History and try again.
                    </p>
                  </div>
                  <button
                    type="button"
                    onclick={() => appStore.navigateTo('history')}
                    class="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-semibold text-primary-foreground transition hover:brightness-110"
                  >
                    <History size={16} />
                    Go to History
                  </button>
                </div>
              {/if}

            {:else if appStore.activeRoute === 'settings'}
              <Settings />
            {/if}
          </ErrorBoundary>
        </section>
      </div>
    </main>
  {/snippet}
</Layout>

{#if appStore.isLoading}
  <LoadingOverlay />
{/if}
