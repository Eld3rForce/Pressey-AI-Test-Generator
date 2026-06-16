<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../lib/utils';

  interface Props {
    /** Tooltip body copy (e.g. "MCQ = Multiple Choice Questions"). */
    text: string;
    /** Extra utility classes merged into the trigger wrapper. */
    class?: string;
    /** Element the tooltip describes — wrapped, focusable, aria-describedby. */
    children?: Snippet;
  }

  let { text, class: className = '', children }: Props = $props();

  // data-visible drives CSS visibility and a hook for jsdom tests.
  let visible = $state(false);
  // Unique per-instance id so multiple tooltips on one page don't collide.
  const tipId = `tooltip-${Math.random().toString(36).slice(2, 9)}`;
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  class={cn('tooltip-wrapper', className)}
  tabindex="0"
  aria-describedby={tipId}
  data-visible={visible}
  onmouseenter={() => (visible = true)}
  onmouseleave={() => (visible = false)}
  onfocusin={() => (visible = true)}
  onfocusout={() => (visible = false)}
>
  {#if children}
    {@render children()}
  {/if}
  <span id={tipId} role="tooltip" class="tooltip-bubble micro-label">
    {text}
  </span>
</span>

<style>
  .tooltip-wrapper {
    position: relative;
    display: inline-block;
    border-radius: 0.25rem;
    outline: none;
  }
  .tooltip-wrapper:focus-visible {
    box-shadow: 0 0 0 2px var(--color-accent);
  }
  .tooltip-bubble {
    position: absolute;
    bottom: calc(100% + 0.4rem);
    left: 50%;
    transform: translateX(-50%) translateY(0.25rem);
    padding: 0.45rem 0.7rem;
    background-color: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    color: var(--color-foreground);
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.15s, transform 0.15s, visibility 0s 0.15s;
    z-index: 50;
    pointer-events: none;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.45);
    backdrop-filter: blur(12px);
  }
  .tooltip-wrapper[data-visible='true'] .tooltip-bubble,
  .tooltip-wrapper:hover .tooltip-bubble,
  .tooltip-wrapper:focus-within .tooltip-bubble {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0);
    transition: opacity 0.15s, transform 0.15s, visibility 0s;
  }
</style>
