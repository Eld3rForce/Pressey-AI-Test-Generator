<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="studio-bg flex h-screen w-full overflow-hidden">
  {@render children()}
</div>
