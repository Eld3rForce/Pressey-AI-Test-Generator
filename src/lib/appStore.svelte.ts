// ============================================================
// App Store — Svelte 5 runes-based global navigation & state
// ============================================================
// Uses $state rune (requires .svelte.ts extension) for deep
// reactivity. State is wrapped in an object because Svelte 5
// disallows reassigning directly-exported $state variables.
// All route components and App.svelte read/write via appStore
// to coordinate navigation without a routing library.
// ============================================================

export type RouteId = 'generate' | 'take' | 'history' | 'review' | 'settings';

export interface NavigateParams {
  selectedTestId?: number;
  selectedAttemptId?: number;
}

// ── Reactive store (class — Svelte 5 supports $state as
//    class field declarations) ──────────────────────────────────

class AppStore {
  activeRoute = $state<RouteId>('generate');
  selectedTestId = $state<number | null>(null);
  selectedAttemptId = $state<number | null>(null);
  isLoading = $state(false);
  error = $state<string | null>(null);

  navigateTo(route: RouteId, params?: NavigateParams): void {
    this.activeRoute = route;
    this.isLoading = false;
    this.error = null;

    if (params !== undefined) {
      if (params.selectedTestId !== undefined) {
        this.selectedTestId = params.selectedTestId;
      }
      if (params.selectedAttemptId !== undefined) {
        this.selectedAttemptId = params.selectedAttemptId;
      }
    }
  }
}

export const appStore = new AppStore();
