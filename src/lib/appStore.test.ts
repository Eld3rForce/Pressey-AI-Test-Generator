import { describe, it, expect } from 'vitest';
import { appStore, type RouteId } from './appStore.svelte';

function resetStore(): void {
  appStore.navigateTo('generate');
  appStore.selectedTestId = null;
  appStore.selectedAttemptId = null;
  appStore.isLoading = false;
  appStore.error = null;
}

beforeEach(resetStore);

describe('navigateTo', () => {
  it('updates activeRoute to the target route', () => {
    expect(appStore.activeRoute).toBe('generate');

    appStore.navigateTo('take');
    expect(appStore.activeRoute).toBe('take');

    appStore.navigateTo('history');
    expect(appStore.activeRoute).toBe('history');

    appStore.navigateTo('review');
    expect(appStore.activeRoute).toBe('review');

    appStore.navigateTo('settings');
    expect(appStore.activeRoute).toBe('settings');
  });

  it('resets isLoading to false on every navigation', () => {
    appStore.isLoading = true;
    appStore.navigateTo('history');
    expect(appStore.isLoading).toBe(false);
  });

  it('clears error on every navigation', () => {
    appStore.error = 'Something broke';
    appStore.navigateTo('take');
    expect(appStore.error).toBeNull();
  });
});

describe('navigateTo with params', () => {
  it('sets selectedTestId when provided in params', () => {
    appStore.navigateTo('take', { selectedTestId: 42 });
    expect(appStore.selectedTestId).toBe(42);
    expect(appStore.activeRoute).toBe('take');
  });

  it('sets selectedAttemptId when provided in params', () => {
    appStore.navigateTo('review', { selectedAttemptId: 99 });
    expect(appStore.selectedAttemptId).toBe(99);
    expect(appStore.activeRoute).toBe('review');
  });

  it('sets both testId and attemptId simultaneously', () => {
    appStore.navigateTo('review', { selectedTestId: 10, selectedAttemptId: 5 });
    expect(appStore.selectedTestId).toBe(10);
    expect(appStore.selectedAttemptId).toBe(5);
    expect(appStore.activeRoute).toBe('review');
  });

  it('preserves existing selectedTestId when navigating without params', () => {
    appStore.navigateTo('take', { selectedTestId: 100 });
    expect(appStore.selectedTestId).toBe(100);

    appStore.navigateTo('history');
    expect(appStore.selectedTestId).toBe(100);
  });

  it('preserves existing selectedAttemptId when navigating without params', () => {
    appStore.navigateTo('review', { selectedAttemptId: 77 });
    expect(appStore.selectedAttemptId).toBe(77);

    appStore.navigateTo('generate');
    expect(appStore.selectedAttemptId).toBe(77);
  });

  it('updates only selectedTestId when selectedAttemptId is omitted', () => {
    appStore.navigateTo('review', { selectedTestId: 10, selectedAttemptId: 5 });
    expect(appStore.selectedTestId).toBe(10);
    expect(appStore.selectedAttemptId).toBe(5);

    appStore.navigateTo('take', { selectedTestId: 20 });
    expect(appStore.selectedTestId).toBe(20);
    expect(appStore.selectedAttemptId).toBe(5);
  });
});

describe('navigateTo edge cases', () => {
  it('handles undefined params gracefully', () => {
    appStore.navigateTo('settings', undefined);
    expect(appStore.activeRoute).toBe('settings');
    // Undefined params should not throw — state values are left as-is.
  });

  it('handles empty params object gracefully', () => {
    appStore.navigateTo('history', {});
    expect(appStore.activeRoute).toBe('history');
  });

  it('handles rapid successive navigations', () => {
    appStore.navigateTo('take', { selectedTestId: 1 });
    appStore.navigateTo('review', { selectedTestId: 1, selectedAttemptId: 2 });
    appStore.navigateTo('history');

    expect(appStore.activeRoute).toBe('history');
    expect(appStore.selectedTestId).toBe(1);
    expect(appStore.selectedAttemptId).toBe(2);
  });

  it('allows all valid RouteId values', () => {
    const routes: RouteId[] = ['generate', 'take', 'history', 'review', 'settings'];
    for (const route of routes) {
      appStore.navigateTo(route);
      expect(appStore.activeRoute).toBe(route);
    }
  });
});

describe('initial state', () => {
  it('starts on the generate route', () => {
    appStore.navigateTo('generate');
    expect(appStore.activeRoute).toBe('generate');
    expect(appStore.selectedTestId).toBeNull();
    expect(appStore.selectedAttemptId).toBeNull();
    expect(appStore.isLoading).toBe(false);
    expect(appStore.error).toBeNull();
  });
});

describe('error state', () => {
  it('can set and clear error directly', () => {
    appStore.error = 'Test error message';
    expect(appStore.error).toBe('Test error message');

    appStore.error = null;
    expect(appStore.error).toBeNull();
  });

  it('navigateTo clears a previously set error', () => {
    appStore.error = 'Something went wrong';
    appStore.navigateTo('generate');
    expect(appStore.error).toBeNull();
  });
});

describe('isLoading state', () => {
  it('can be set to true and back to false', () => {
    appStore.isLoading = true;
    expect(appStore.isLoading).toBe(true);

    appStore.isLoading = false;
    expect(appStore.isLoading).toBe(false);
  });

  it('navigateTo resets isLoading from true', () => {
    appStore.isLoading = true;
    appStore.navigateTo('take');
    expect(appStore.isLoading).toBe(false);
  });
});
