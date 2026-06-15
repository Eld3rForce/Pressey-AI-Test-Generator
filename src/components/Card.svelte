<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../lib/utils';

  type Padding = 'none' | 'sm' | 'md' | 'lg';

  interface Props {
    title?: string;
    eyebrow?: string;
    padding?: Padding;
    class?: string;
    children?: Snippet;
  }

  let {
    title = '',
    eyebrow = '',
    padding = 'md',
    class: className = '',
    children,
  }: Props = $props();

  const paddingClasses: Record<Padding, string> = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-8',
  };
</script>

<section class={cn('surface-card', paddingClasses[padding], className)}>
  {#if title || eyebrow}
    <header class="mb-4 flex flex-col gap-1">
      {#if eyebrow}
        <span class="micro-label">{eyebrow}</span>
      {/if}
      {#if title}
        <h3 class="font-display text-base font-semibold text-foreground">
          {title}
        </h3>
      {/if}
    </header>
  {/if}

  {#if children}
    <div class="text-sm text-foreground">
      {@render children()}
    </div>
  {/if}
</section>
