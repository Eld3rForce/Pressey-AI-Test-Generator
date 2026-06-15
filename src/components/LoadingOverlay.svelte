<script lang="ts">
  let { message = 'Loading…' }: { message?: string } = $props();
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
  role="status"
  aria-live="polite"
>
  <div class="surface-card w-full max-w-xs space-y-4 p-8 text-center">
    <div
      class="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent"
      aria-hidden="true"
    ></div>
    <p class="text-sm text-muted-foreground">{message}</p>
  </div>
</div>
