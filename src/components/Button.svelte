<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../lib/utils';

  type Variant = 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  type Size = 'sm' | 'md' | 'lg';

  interface Props {
    variant?: Variant;
    size?: Size;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    class?: string;
    onclick?: (event: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    variant = 'default',
    size = 'md',
    disabled = false,
    type = 'button',
    class: className = '',
    onclick,
    children,
  }: Props = $props();

  const baseClasses =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

  const variantClasses: Record<Variant, string> = {
    default: 'bg-primary text-primary-foreground hover:brightness-110',
    outline: 'border border-border text-foreground hover:bg-accent/10',
    ghost: 'bg-transparent text-foreground hover:bg-accent/10',
    destructive: 'bg-destructive text-destructive-foreground hover:brightness-110',
    secondary: 'bg-secondary text-secondary-foreground hover:brightness-110',
  };

  const sizeClasses: Record<Size, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
  };
</script>

<button
  {type}
  {disabled}
  onclick={onclick}
  class={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
>
  {#if children}
    {@render children()}
  {/if}
</button>
