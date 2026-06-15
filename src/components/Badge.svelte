<script lang="ts">
  import { cn } from '../lib/utils';

  type Variant = 'default' | 'success' | 'warning' | 'destructive' | 'accent' | 'primary';

  interface Props {
    text: string;
    variant?: Variant;
    class?: string;
  }

  let {
    text,
    variant = 'default',
    class: className = '',
  }: Props = $props();

  const variantClasses: Record<Variant, string> = {
    default: 'border-border bg-secondary/40 text-muted-foreground',
    success: 'border-success/40 bg-success/15 text-success',
    warning: 'border-warning/40 bg-warning/15 text-warning',
    destructive: 'border-destructive/40 bg-destructive/15 text-destructive',
    accent: 'border-accent/40 bg-accent/15 text-accent',
    primary: 'border-primary/40 bg-primary/15 text-primary',
  };
</script>

<span
  class={cn(
    'micro-label inline-flex items-center rounded-full border px-2.5 py-0.5',
    variantClasses[variant],
    className,
  )}
>
  {text}
</span>
