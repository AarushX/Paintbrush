<script lang="ts">
  import { sidebarState, loadInitial, refresh, groupedView } from './stores.svelte';
  import { onMount } from 'svelte';
  import TodoItem from './TodoItem.svelte';

  let { open: openProp = true }: { open?: boolean } = $props();
  $effect.pre(() => { sidebarState.open = openProp; });

  let groups = $derived(groupedView());

  // Push Canvas's content inward to make room for the sidebar instead of
  // floating over it. Width changes are animated via the same easing the
  // sidebar uses, so the page reflow stays in lockstep with the panel.
  const EXPANDED_W = 340;
  const RAIL_W = 14;
  $effect(() => {
    const w = sidebarState.open ? EXPANDED_W : RAIL_W;

    // Tell our fixed-position viewer hosts how much room to leave on the
    // right via a CSS variable on <html>. The viewer-host inject.ts files
    // read `var(--pb-sidebar-w, 340px)` so they're never covered by the
    // sidebar. Updates animate via the host's own transition.
    document.documentElement.style.setProperty('--pb-sidebar-w', `${w}px`);

    // Canvas-native pages (no viewer) get their content pushed via body
    // padding-right so the sidebar isn't floating over them.
    document.body.style.transition = 'padding-right 300ms cubic-bezier(0.22,0.61,0.36,1)';
    document.body.style.paddingRight = `${w}px`;

    const prevOverflowX = document.documentElement.style.overflowX;
    document.documentElement.style.overflowX = 'hidden';

    const canvasRightFixed = document.querySelectorAll<HTMLElement>(
      '#right-side-wrapper, #right-side, .fixed-right'
    );
    for (const el of canvasRightFixed) {
      const pos = getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'absolute') continue;
      el.style.transition = 'right 300ms cubic-bezier(0.22,0.61,0.36,1)';
      el.style.right = `${w}px`;
    }

    return () => {
      document.documentElement.style.removeProperty('--pb-sidebar-w');
      document.body.style.paddingRight = '';
      document.body.style.transition = '';
      document.documentElement.style.overflowX = prevOverflowX;
      for (const el of canvasRightFixed) {
        el.style.right = '';
        el.style.transition = '';
      }
    };
  });

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

  // ---------------------------------------------------------------------------
  // Canvas slot: move Canvas's #right-side widgets into a light-DOM slot that
  // sits flush against the bottom of our sidebar. The slot lives outside the
  // shadow root so Canvas's own CSS continues to apply to its widgets.
  // ---------------------------------------------------------------------------
  const SLOT_ID = 'paintbrush-canvas-slot';
  const SLOT_MAX_VH = 50;

  function ensureSlot(): HTMLElement {
    let slot = document.getElementById(SLOT_ID);
    if (!slot) {
      slot = document.createElement('div');
      slot.id = SLOT_ID;
      document.body.appendChild(slot);
    }
    return slot;
  }

  function applySlotStyle(open: boolean) {
    const slot = document.getElementById(SLOT_ID);
    if (!slot) return;
    if (!open) {
      slot.style.display = 'none';
      return;
    }
    slot.style.cssText = `
      position: fixed;
      bottom: 0;
      right: var(--pb-scrollbar-w, 0px);
      width: 340px;
      max-height: ${SLOT_MAX_VH}vh;
      overflow-y: auto;
      z-index: 2147483646;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(12px) saturate(150%);
      border-left: 1px solid rgb(228 228 231);
      border-top: 1px solid rgb(228 228 231);
      box-shadow: 0 -10px 28px rgba(0,0,0,0.06);
      padding: 12px 14px;
      font-family: 'Inter', system-ui, sans-serif;
      box-sizing: border-box;
    `;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      slot.style.background = 'rgba(24, 24, 27, 0.94)';
      slot.style.borderLeftColor = 'rgb(39 39 42)';
      slot.style.borderTopColor = 'rgb(39 39 42)';
      slot.style.color = 'rgb(228 228 231)';
    }
  }

  interface MovedRecord {
    parent: HTMLElement;
    children: ChildNode[];
  }

  let movedRecord: MovedRecord | null = null;

  function moveRightSideIntoSlot(): void {
    const rs = document.querySelector<HTMLElement>('#right-side');
    const slot = document.getElementById(SLOT_ID);
    if (!rs || !slot) return;
    if (movedRecord) return; // already moved
    if (rs.children.length === 0) return;

    slot.innerHTML = '';
    const header = document.createElement('div');
    header.style.cssText =
      'font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:rgb(113 113 122);font-weight:600;margin-bottom:8px;';
    header.textContent = 'From Canvas';
    slot.appendChild(header);

    const moved: ChildNode[] = [];
    while (rs.firstChild) {
      moved.push(rs.firstChild);
      slot.appendChild(rs.firstChild);
    }
    movedRecord = { parent: rs, children: moved };
  }

  function restoreRightSide(): void {
    if (!movedRecord) return;
    for (const c of movedRecord.children) {
      movedRecord.parent.appendChild(c);
    }
    movedRecord = null;
    const slot = document.getElementById(SLOT_ID);
    if (slot) slot.innerHTML = '';
  }

  $effect(() => {
    if (!sidebarState.open) {
      applySlotStyle(false);
      return;
    }
    ensureSlot();
    applySlotStyle(true);

    // Initial move
    moveRightSideIntoSlot();

    // Hide the slot entirely when there's nothing to show
    const slot = document.getElementById(SLOT_ID)!;
    if (!movedRecord || movedRecord.children.length === 0) {
      slot.style.display = 'none';
    }

    // Keep --pb-canvas-slot-h in sync so the todo scroll area can shrink
    function syncSidebarHeight() {
      const s = document.getElementById(SLOT_ID);
      if (!s || s.style.display === 'none') {
        document.documentElement.style.setProperty('--pb-canvas-slot-h', '0px');
        return;
      }
      const rect = s.getBoundingClientRect();
      const h = Math.min(rect.height, window.innerHeight * (SLOT_MAX_VH / 100));
      document.documentElement.style.setProperty('--pb-canvas-slot-h', `${Math.round(h)}px`);
    }
    syncSidebarHeight();
    const ro = new ResizeObserver(syncSidebarHeight);
    ro.observe(slot);

    // SPA-navigation watcher: re-attach when Canvas re-renders #right-side
    let lastSig = '';
    function getSig(): string {
      const rs = document.querySelector('#right-side');
      if (!rs) return 'none';
      return rs.innerHTML ? rs.innerHTML.length + ':has-content' : 'empty';
    }
    const interval = window.setInterval(() => {
      const sig = getSig();
      if (sig !== lastSig) {
        lastSig = sig;
        // Canvas replaced #right-side with fresh content; re-move it
        if (!movedRecord) {
          moveRightSideIntoSlot();
          const s = document.getElementById(SLOT_ID);
          if (s) {
            if (!movedRecord || movedRecord.children.length === 0) {
              s.style.display = 'none';
            } else {
              applySlotStyle(true);
            }
          }
        }
        syncSidebarHeight();
      }
    }, 600);

    return () => {
      window.clearInterval(interval);
      ro.disconnect();
      restoreRightSide();
      document.documentElement.style.removeProperty('--pb-canvas-slot-h');
      const s = document.getElementById(SLOT_ID);
      if (s) s.remove();
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
    class="fixed top-0 z-[2147483647] h-screen bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl backdrop-saturate-150 border-l border-zinc-200/50 dark:border-zinc-800/50 text-zinc-900 dark:text-zinc-100 font-sans shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] relative"
    style="right: var(--pb-scrollbar-w, 0px); width: 340px; will-change: transform;">

    <!-- Brand-colored top accent stripe (matches Canvas's left-nav color) -->
    <div class="pointer-events-none absolute left-0 right-0 top-0 h-[3px]" style="background: linear-gradient(90deg, var(--pb-brand), color-mix(in srgb, var(--pb-brand) 60%, transparent));"></div>

    <!-- Left edge gradient accent -->
    <div class="pointer-events-none absolute left-0 top-0 bottom-0 w-px" style="background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--pb-brand) 35%, transparent), transparent);"></div>

    <header class="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-200/50 dark:border-zinc-800/50">
      <div class="flex items-center gap-2">
        <!-- Brand swatch matching Canvas's nav -->
        <span class="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shadow-sm" style="background: var(--pb-brand); color: var(--pb-brand-fg); box-shadow: 0 1px 2px color-mix(in srgb, var(--pb-brand) 30%, transparent);">P</span>
        <h2 class="text-base font-semibold tracking-tight" style="color: var(--pb-brand-strong);">Paintbrush</h2>
        {#if totalCount() > 0}
          <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style="background: var(--pb-brand-soft); color: var(--pb-brand-strong);">{totalCount()}</span>
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
            ? 'shadow-sm'
            : 'bg-zinc-100/80 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/60'}`}
          style={sidebarState.filter === value
            ? `background: var(--pb-brand); color: var(--pb-brand-fg); box-shadow: 0 2px 6px color-mix(in srgb, var(--pb-brand) 35%, transparent);`
            : ''}
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
      <div class="relative overflow-y-auto" style="height: calc(100vh - 102px - var(--pb-canvas-slot-h, 0px));">
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
  <!-- Full-height slim rail collapsed state — sibling to Canvas's left nav -->
  <button
    onclick={() => sidebarState.open = true}
    class="fixed top-0 h-screen z-[2147483647] flex items-center justify-center transition-[width,box-shadow] duration-200 ease-out group"
    aria-label="Expand Paintbrush sidebar"
    title="Expand Paintbrush sidebar"
    style="right: var(--pb-scrollbar-w, 0px); width: 14px; background: var(--pb-brand); color: var(--pb-brand-fg); box-shadow: inset 2px 0 0 color-mix(in srgb, var(--pb-brand-fg) 12%, transparent), -2px 0 18px color-mix(in srgb, var(--pb-brand) 22%, transparent);"
    onmouseenter={(e) => (e.currentTarget.style.width = '20px')}
    onmouseleave={(e) => (e.currentTarget.style.width = '14px')}>
    <svg class="w-3 h-3 opacity-60 group-hover:opacity-100 group-hover:-translate-x-px transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  </button>
{/if}
