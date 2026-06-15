<script lang="ts">
  import { cn } from '../lib/utils';

  type ToastType = 'success' | 'error';

  interface Props {
    message: string;
    type?: ToastType;
    duration?: number;
  }

  let {
    message,
    type = 'success',
    duration = 3000,
  }: Props = $props();

  let visible = $state(true);
  let timerId = $state<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer(): void {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  $effect(() => {
    // Re-arm the timer whenever the message or duration changes.
    visible = true;
    clearTimer();
    timerId = setTimeout(() => {
      visible = false;
      timerId = null;
    }, duration);

    return () => {
      clearTimer();
    };
  });

  const typeClasses: Record<ToastType, string> = {
    success: 'border-success/40 bg-success/10 text-success',
    error: 'border-destructive/40 bg-destructive/10 text-destructive',
  };

  const typeIcon: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
  };
</script>

{#if visible}
  <div
    role="status"
    aria-live="polite"
    class="fixed bottom-6 right-6 z-50 max-w-xs"
  >
    <div
      class={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-[0_12px_32px_oklch(0_0_0_/_0.45)]',
        'backdrop-blur-md',
        typeClasses[type],
      )}
    >
      <span class="font-mono text-sm font-bold" aria-hidden="true">
        {typeIcon[type]}
      </span>
      <p class="flex-1 text-sm font-medium text-foreground">
        {message}
      </p>
    </div>
  </div>
{/if}
