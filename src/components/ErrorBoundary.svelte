<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  let errorKey = $state(0);
  let caughtError = $state<string | null>(null);

  function handleReload(): void {
    caughtError = null;
    errorKey++;
  }

  // Capture unhandled rejections and global errors scoped to this boundary's lifetime.
  $effect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
      caughtError =
        event.reason instanceof Error
          ? event.reason.message
          : 'An unexpected error occurred';
      event.preventDefault();
    };

    const onError = (event: ErrorEvent): void => {
      caughtError = event.message || 'An unexpected error occurred';
      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onError);

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onError);
    };
  });
</script>

{#if caughtError}
  <div class="flex min-h-[50vh] items-center justify-center p-8">
    <div class="surface-card max-w-md space-y-4 p-8 text-center">
      <p class="micro-label text-destructive mb-2">Something went wrong</p>
      <p class="text-sm leading-relaxed text-muted-foreground">{caughtError}</p>
      <button
        type="button"
        onclick={handleReload}
        class="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition hover:brightness-110"
      >
        Reload
      </button>
    </div>
  </div>
{:else}
  {#key errorKey}
    {@render children()}
  {/key}
{/if}
