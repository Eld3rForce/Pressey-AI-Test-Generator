<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../lib/utils';

  interface Props {
    open: boolean;
    title?: string;
    onconfirm?: () => void;
    oncancel?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    class?: string;
    children?: Snippet;
    footer?: Snippet;
  }

  let {
    open = $bindable(false),
    title = '',
    onconfirm,
    oncancel,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    class: className = '',
    children,
    footer,
  }: Props = $props();

  function close(): void {
    open = false;
    oncancel?.();
  }

  function confirm(): void {
    onconfirm?.();
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && open) {
      close();
    }
  }

  let dialogRef: HTMLDivElement | undefined = $state();

  function trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !dialogRef) return;
    const focusable = dialogRef.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  $effect(() => {
    if (open && dialogRef) {
      const focusable = dialogRef.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        dialogRef.focus();
      }
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby={title ? 'modal-title' : undefined}
    aria-label={title ? undefined : 'Dialog'}
    aria-describedby="modal-body"
    class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
    onclick={handleBackdropClick}
    onkeydown={trapFocus}
    bind:this={dialogRef}
    tabindex="-1"
  >
    <div
      class={cn(
        'surface-card relative w-full max-w-md space-y-4 p-6',
        'shadow-[0_24px_64px_oklch(0_0_0_/_0.55)]',
        className,
      )}
    >
      {#if title}
        <h2 id="modal-title" class="font-display text-lg font-bold text-foreground">
          {title}
        </h2>
      {/if}

      {#if children}
        <div id="modal-body" class="text-sm leading-relaxed text-muted-foreground">
          {@render children()}
        </div>
      {/if}

      {#if footer}
        <div class="flex items-center justify-end gap-3 pt-2">
          {@render footer()}
        </div>
      {:else}
        <div class="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onclick={close}
            class="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onclick={confirm}
            class="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {confirmLabel}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
