<script lang="ts">
  import { cn } from '../lib/utils';
  import FileQuestion from 'lucide-svelte/icons/file-question';
  import Play from 'lucide-svelte/icons/play';
  import History from 'lucide-svelte/icons/history';
  import Settings from 'lucide-svelte/icons/settings';
  import Logo from './Logo.svelte';

  type RouteId = 'generate' | 'take' | 'history' | 'settings';

  interface Props {
    activeRoute: RouteId;
    onnavigate: (route: RouteId) => void;
  }

  let { activeRoute, onnavigate }: Props = $props();

  interface NavItem {
    id: RouteId;
    label: string;
    icon: typeof FileQuestion;
    description: string;
  }

  const navItems: NavItem[] = [
    { id: 'generate', label: 'Generate Test', icon: FileQuestion, description: 'AI-authored questions' },
    { id: 'take', label: 'Take Test', icon: Play, description: 'Run a saved test' },
    { id: 'history', label: 'Test History', icon: History, description: 'Past runs & attempts' },
    { id: 'settings', label: 'Settings', icon: Settings, description: 'API & preferences' },
  ];
</script>

<aside
  class="surface-card sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-6 rounded-none border-r border-border px-4 py-6"
>
  <!-- Logo / brand area -->
  <div class="flex items-center gap-2.5 px-2">
    <div
      class="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/30"
    >
      <Logo size={28} />
    </div>
    <div class="flex flex-col leading-tight">
      <span class="font-display text-base font-bold tracking-tight text-foreground">Pressey</span>
      <span class="micro-label text-[0.6rem]">AI · Test Studio</span>
    </div>
  </div>

  <hr class="section-divider m-0" />

  <!-- Workspace nav group -->
  <nav class="flex flex-1 flex-col gap-1" aria-label="Primary navigation">
    <span class="micro-label px-3 pb-1.5">Workspace</span>

    {#each navItems as item (item.id)}
      {@const isActive = activeRoute === item.id}
      {@const Icon = item.icon}
      <button
        type="button"
        data-testid="nav-{item.id}"
        aria-current={isActive ? 'page' : undefined}
        onclick={() => onnavigate(item.id)}
        class={cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          isActive
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground',
        )}
      >
        <!-- Active rail indicator -->
        <span
          aria-hidden="true"
          class={cn(
            'absolute inset-y-2 left-0 w-0.5 rounded-full transition-all',
            isActive ? 'bg-primary' : 'bg-transparent group-hover:bg-border',
          )}
        ></span>

        <Icon
          size={18}
          strokeWidth={isActive ? 2.25 : 2}
          class={cn('shrink-0 transition-transform group-hover:scale-105', isActive && 'text-primary')}
        />
        <div class="flex min-w-0 flex-1 flex-col leading-tight">
          <span class="text-sm font-medium">{item.label}</span>
          <span
            class={cn(
              'truncate text-[0.6875rem] font-normal',
              isActive ? 'text-primary/70' : 'text-muted-foreground/70',
            )}
          >
            {item.description}
          </span>
        </div>
      </button>
    {/each}
  </nav>

  <!-- Footer status strip -->
  <div class="command-strip self-start">
    <span class="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px_oklch(0.74_0.14_155)]"></span>
    <span>v0.1 · local</span>
  </div>
</aside>
