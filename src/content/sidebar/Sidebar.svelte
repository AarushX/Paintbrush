<script lang="ts">
  import { sidebarState, loadInitial, refresh, groupedView } from './stores.svelte';
  import { onMount } from 'svelte';
  import TodoItem from './TodoItem.svelte';

  let { open: openProp = true }: { open?: boolean } = $props();
  $effect.pre(() => { sidebarState.open = openProp; });

  let groups = $derived(groupedView());
  let overdueCount = $derived(groups.overdue.length);

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

  const groupOrder: Array<[keyof ReturnType<typeof groupedView>, string, string, string]> = [
    ['overdue', 'Overdue', 'text-red-500 dark:text-red-400', 'bg-red-500'],
    ['today', 'Today', 'text-indigo-600 dark:text-indigo-400', 'bg-indigo-500'],
    ['tomorrow', 'Tomorrow', 'text-violet-600 dark:text-violet-400', 'bg-violet-500'],
    ['thisWeek', 'This Week', 'text-zinc-600 dark:text-zinc-400', 'bg-zinc-400'],
    ['later', 'Later', 'text-zinc-500 dark:text-zinc-500', 'bg-zinc-300 dark:bg-zinc-600']
  ];

  function totalCount() {
    return groups.overdue.length + groups.today.length + groups.tomorrow.length + groups.thisWeek.length + groups.later.length;
  }
</script>

{#if sidebarState.open}
  <aside
    class="fixed right-0 top-0 z-[2147483647] h-screen bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl backdrop-saturate-150 border-l border-zinc-200/50 dark:border-zinc-800/50 text-zinc-900 dark:text-zinc-100 font-sans shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] relative"
    style="width: 340px; will-change: transform;">

    <!-- Left edge gradient accent -->
    <div class="pointer-events-none absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-indigo-400/30 dark:via-indigo-500/20 to-transparent"></div>

    <header class="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-200/50 dark:border-zinc-800/50">
      <div class="flex items-center gap-2">
        <h2 class="text-base font-semibold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Paintbrush</h2>
        {#if totalCount() > 0}
          <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">{totalCount()}</span>
        {/if}
      </div>
      <div class="flex items-center gap-0.5">
        <button
          class="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 disabled:opacity-40 transition-colors group"
          disabled={sidebarState.loading}
          onclick={() => refresh()}
          aria-label="Refresh">
          <svg class="w-3.5 h-3.5 transition-transform duration-500 group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button
          class="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 transition-colors"
          onclick={() => sidebarState.open = false}
          aria-label="Collapse sidebar">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Filter chips -->
    <div class="flex items-center gap-1 px-3 py-2.5 border-b border-zinc-200/50 dark:border-zinc-800/50 overflow-x-auto">
      {#each [
        ['all', 'All'],
        ['assignment', 'Asgn'],
        ['quiz', 'Quiz'],
        ['discussion_topic', 'Disc'],
        ['planner_note', 'Notes']
      ] as const as [value, label]}
        <button
          onclick={() => (sidebarState.filter = value)}
          class={`px-2.5 py-1 text-[11px] font-medium rounded-full whitespace-nowrap transition-all duration-150 active:scale-95 ${sidebarState.filter === value
            ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/30'
            : 'bg-zinc-100/80 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/60'}`}
        >
          {label}
        </button>
      {/each}
    </div>

    {#if sidebarState.error}
      <div class="p-4 text-xs text-red-500 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 m-3 rounded-lg border border-red-200/50 dark:border-red-900/30">
        Error: {sidebarState.error}
      </div>
    {:else if totalCount() === 0 && !sidebarState.loading}
      <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div class="text-3xl mb-3">🎉</div>
        <p class="text-sm font-medium text-zinc-600 dark:text-zinc-400">All caught up</p>
        <p class="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">No items due in the next 30 days.</p>
      </div>
    {:else}
      <div class="relative overflow-y-auto" style="height: calc(100vh - 102px);">
        {#each groupOrder as [key, label, color, dotColor]}
          {#if groups[key].length > 0}
            <div class={`sticky top-0 z-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm px-3 py-1.5 flex items-center gap-1.5 border-b border-zinc-100/50 dark:border-zinc-800/30 ${color}`}>
              <span class={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`}></span>
              <span class="text-[10px] font-semibold uppercase tracking-[0.08em]">{label}</span>
              <span class="text-zinc-400 dark:text-zinc-500 font-normal text-[10px] ml-0.5">{groups[key].length}</span>
            </div>
            {#each groups[key] as item (item.plannable_id + ':' + item.plannable_type)}
              <TodoItem {item} color={sidebarState.colors['course_' + item.course_id] ?? '#cbd5e1'} />
            {/each}
          {/if}
        {/each}
        <!-- Scroll fade mask -->
        <div class="pointer-events-none sticky bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white dark:from-zinc-900 to-transparent"></div>
      </div>
    {/if}
  </aside>
{:else}
  <!-- Slim collapsed bar -->
  <button
    onclick={() => sidebarState.open = true}
    class="fixed right-0 top-1/2 -translate-y-1/2 z-[2147483647] w-10 flex flex-col items-center justify-center gap-2 py-4 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl border border-r-0 border-zinc-200/50 dark:border-zinc-800/50 rounded-l-xl shadow-lg shadow-black/10 dark:shadow-black/30 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-white/95 dark:hover:bg-zinc-800/95 transition-all duration-200 group"
    aria-label="Expand sidebar"
    style="min-height: 100px;">
    <!-- Left edge gradient accent -->
    <div class="pointer-events-none absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-indigo-400/40 dark:via-indigo-500/30 to-transparent rounded-l-xl"></div>
    <svg class="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
    <span class="text-[10px] font-semibold tracking-tight bg-gradient-to-b from-indigo-600 to-violet-600 bg-clip-text text-transparent" style="writing-mode: vertical-rl; transform: rotate(180deg);">Paintbrush</span>
    {#if overdueCount > 0}
      <span class="w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold animate-pulse shadow-sm shadow-red-500/40">{overdueCount > 9 ? '9+' : overdueCount}</span>
    {/if}
  </button>
{/if}
