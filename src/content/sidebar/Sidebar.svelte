<script lang="ts">
  import { sidebarState, loadInitial, refresh, groupedView } from './stores.svelte';
  import { onMount } from 'svelte';
  import TodoItem from './TodoItem.svelte';

  let { open: openProp = true }: { open?: boolean } = $props();
  $effect.pre(() => { sidebarState.open = openProp; });

  let groups = $derived(groupedView());

  onMount(() => {
    loadInitial();
    const onFocus = () => {
      if (Date.now() - sidebarState.lastSyncedAt > 2 * 60_000) refresh();
    };
    window.addEventListener('focus', onFocus);
    const onToggle = () => { sidebarState.open = !sidebarState.open; };
    document.addEventListener('paintbrush:toggle', onToggle);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('paintbrush:toggle', onToggle);
    };
  });

  const groupOrder: Array<[keyof ReturnType<typeof groupedView>, string, string]> = [
    ['overdue', 'Overdue', 'text-red-600 dark:text-red-400'],
    ['today', 'Today', 'text-zinc-700 dark:text-zinc-300'],
    ['tomorrow', 'Tomorrow', 'text-zinc-700 dark:text-zinc-300'],
    ['thisWeek', 'This Week', 'text-zinc-700 dark:text-zinc-300'],
    ['later', 'Later', 'text-zinc-700 dark:text-zinc-300']
  ];

  function totalCount() {
    return groups.overdue.length + groups.today.length + groups.tomorrow.length + groups.thisWeek.length + groups.later.length;
  }
</script>

<aside class={`fixed right-0 top-0 z-[2147483647] h-screen bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-sans shadow-lg transition-transform duration-200 ease-out ${sidebarState.open ? 'translate-x-0' : 'translate-x-[calc(100%-44px)]'}`}
       style="width: 320px; will-change: transform;">
  <header class="flex items-center justify-between gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800">
    <div class="flex items-center gap-2">
      <h2 class="text-sm font-semibold tracking-tight">Paintbrush</h2>
      <span class="text-[11px] text-zinc-400">{totalCount()}</span>
    </div>
    <div class="flex items-center gap-1">
      <button class="px-1.5 py-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-50"
              disabled={sidebarState.loading}
              onclick={() => refresh()}
              aria-label="Refresh">↻</button>
      <button class="px-1.5 py-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              onclick={() => sidebarState.open = !sidebarState.open}
              aria-label="Collapse">{sidebarState.open ? '›' : '‹'}</button>
    </div>
  </header>

  <div class="flex items-center gap-1 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
    {#each [
      ['all', 'All'],
      ['assignment', 'Asgn'],
      ['quiz', 'Quiz'],
      ['discussion_topic', 'Disc'],
      ['planner_note', 'Notes']
    ] as const as [value, label]}
      <button
        onclick={() => (sidebarState.filter = value)}
        class={`px-2 py-0.5 text-[11px] rounded-full whitespace-nowrap transition-colors ${sidebarState.filter === value ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
      >
        {label}
      </button>
    {/each}
  </div>

  {#if sidebarState.error}
    <div class="p-3 text-xs text-red-600 dark:text-red-400">Error: {sidebarState.error}</div>
  {:else if totalCount() === 0 && !sidebarState.loading}
    <div class="p-8 text-center text-sm text-zinc-500">All caught up 🎉</div>
  {:else}
    <div class="overflow-y-auto" style="height: calc(100vh - 90px);">
      {#each groupOrder as [key, label, color]}
        {#if groups[key].length > 0}
          <div class={`sticky top-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${color}`}>
            {label} <span class="text-zinc-400 font-normal">{groups[key].length}</span>
          </div>
          {#each groups[key] as item (item.plannable_id + ':' + item.plannable_type)}
            <TodoItem {item} color={sidebarState.colors['course_' + item.course_id] ?? '#cbd5e1'} />
          {/each}
        {/if}
      {/each}
    </div>
  {/if}
</aside>
