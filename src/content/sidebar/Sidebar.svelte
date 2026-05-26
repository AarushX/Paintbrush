<script lang="ts">
  import { sidebarState, loadInitial, refresh, groupedView } from './stores.svelte';
  import { onMount } from 'svelte';
  import TodoItem from './TodoItem.svelte';
  import CourseSelect from './CourseSelect.svelte';
  import SectionNav from '../course-nav/SectionNav.svelte';
  import { parseCourseFromUrl } from '../../lib/course-context';
  import { fetchAllPages, CanvasApiError } from '../../lib/canvas-api';
  import { fetchDashboardCards } from '../dashboard/api';
  import type { FileFull, DashboardCard } from '../../lib/types';

  let { open: openProp = true }: { open?: boolean } = $props();
  $effect.pre(() => { sidebarState.open = openProp; });

  let groups = $derived(groupedView());

  // ---------------------------------------------------------------------------
  // Sidebar view modes. "tasks" is the planner/to-do list (default); "files"
  // shows the current course's files so they can be opened in the file viewer
  // straight from the sidebar.
  // ---------------------------------------------------------------------------
  let view = $state<'tasks' | 'files'>('tasks');
  let currentCourseId = $state<number | null>(parseCourseFromUrl(location.href));
  // The course whose files the Files panel is showing. Defaults to the
  // course you're viewing, but the course selector lets you pick any.
  let selectedCourseId = $state<number | null>(parseCourseFromUrl(location.href));
  let courses = $state<DashboardCard[]>([]);
  let courseFiles = $state<FileFull[]>([]);
  let filesLoading = $state(false);
  let filesError = $state('');
  let filesDisabled = $state(false);
  let filesSearch = $state('');
  let filesLoadedFor: number | null = null;

  // Course options for the picker. Canvas's longName repeats the code, so
  // prefer the cleaner short/original name.
  const courseOptions = $derived(courses.map(c => ({
    id: c.id,
    name: c.shortName || c.originalName || c.longName || `Course ${c.id}`,
    code: c.courseCode,
    color: c.color
  })));

  async function loadFiles(cid: number) {
    filesLoading = true; filesError = ''; filesDisabled = false;
    try {
      courseFiles = await fetchAllPages<FileFull>(`/api/v1/courses/${cid}/files?per_page=100&sort=name`);
      filesLoadedFor = cid;
    } catch (err) {
      filesLoadedFor = cid; // don't retry-loop on a hard failure
      courseFiles = [];
      const status = err instanceof CanvasApiError ? err.status : 0;
      if (status === 403 || status === 401 || status === 404) {
        // The Files tab is hidden / restricted for this course — not an error.
        filesDisabled = true;
      } else {
        filesError = err instanceof Error ? err.message : String(err);
      }
    } finally {
      filesLoading = false;
    }
  }

  // Open a file in the FilePreview viewer. We push the file URL; index.ts's
  // 500ms location poll then mounts the standalone FilePreview deck.
  function openFileInViewer(fileId: number) {
    if (selectedCourseId == null) return;
    history.pushState({}, '', `/courses/${selectedCourseId}/files/${fileId}`);
  }

  const filteredFiles = $derived.by(() => {
    const q = filesSearch.trim().toLowerCase();
    if (!q) return courseFiles;
    return courseFiles.filter(f => f.display_name.toLowerCase().includes(q));
  });

  function fmtSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function fileIcon(name: string): string {
    const ext = name.toLowerCase().split('.').pop() ?? '';
    if (['jpg','jpeg','png','gif','webp','svg','heic'].includes(ext)) return '🖼';
    if (['mp4','mov','avi','webm','mkv'].includes(ext)) return '🎬';
    if (['mp3','wav','aac','flac','m4a'].includes(ext)) return '🎵';
    if (['zip','tar','gz','rar','7z'].includes(ext)) return '📦';
    if (['pdf'].includes(ext)) return '📕';
    if (['doc','docx','rtf'].includes(ext)) return '📝';
    if (['xls','xlsx','csv'].includes(ext)) return '📊';
    if (['ppt','pptx'].includes(ext)) return '📈';
    return '📄';
  }

  // Lazy-load the file list the first time the Files view is opened for a
  // given course, and reload when a different course is selected.
  $effect(() => {
    if (view === 'files' && selectedCourseId != null
        && filesLoadedFor !== selectedCourseId && !filesLoading) {
      loadFiles(selectedCourseId);
    }
  });

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

    // Load the user's course list for the Files-panel course picker.
    fetchDashboardCards()
      .then(list => {
        courses = list;
        // Default the picker to the current course, else the first course.
        if (selectedCourseId == null && list.length > 0) selectedCourseId = list[0].id;
      })
      .catch(() => {});

    const onFocus = () => {
      if (Date.now() - sidebarState.lastSyncedAt > 2 * 60_000) refresh();
    };
    window.addEventListener('focus', onFocus);
    const onToggle = () => { sidebarState.open = !sidebarState.open; };
    document.addEventListener('paintbrush:toggle', onToggle);

    // External request to surface the Files panel (fired by the Files page's
    // "Open files panel" promo). Opens the sidebar and switches to Files.
    const onOpenFiles = () => {
      sidebarState.open = true;
      const cid = parseCourseFromUrl(location.href);
      if (cid != null) selectedCourseId = cid;
      view = 'files';
    };
    document.addEventListener('paintbrush:open-files', onOpenFiles);

    // Track the course id across Canvas's SPA navigation. When you move to
    // a different course, the Files panel follows you (until you pick
    // another course manually from the selector).
    const coursePoll = window.setInterval(() => {
      const cid = parseCourseFromUrl(location.href);
      if (cid !== currentCourseId) {
        currentCourseId = cid;
        if (cid != null) selectedCourseId = cid;
      }
    }, 800);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('paintbrush:toggle', onToggle);
      document.removeEventListener('paintbrush:open-files', onOpenFiles);
      window.clearInterval(coursePoll);
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
    class="fixed top-0 z-[2147483647] h-screen flex flex-col bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl backdrop-saturate-150 border-l border-zinc-200/50 dark:border-zinc-800/50 text-zinc-900 dark:text-zinc-100 font-sans shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] relative"
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

    <!-- Course nav: course picker dropdown + native page chips + a
         separate dropdown for external tools / links -->
    {#if courses.length > 0}
      <div class="px-3 pt-3 pb-3 border-b border-zinc-200/50 dark:border-zinc-800/50 space-y-2">
        <CourseSelect
          courses={courseOptions}
          selectedId={selectedCourseId}
          onSelect={(id) => (selectedCourseId = id)} />
        {#if selectedCourseId != null}
          {#key selectedCourseId}
            <SectionNav courseId={selectedCourseId} live={selectedCourseId === currentCourseId} />
          {/key}
        {/if}
      </div>

      <!-- View tabs: To Do / Files -->
      <div class="flex items-center gap-1 px-3 pt-2.5">
        {#each [['tasks', 'To Do'], ['files', 'Files']] as const as [v, label]}
          <button
            onclick={() => (view = v)}
            class={`flex-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-150 active:scale-95 ${view === v
              ? 'shadow-sm'
              : 'bg-zinc-100/70 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60'}`}
            style={view === v
              ? 'background: var(--pb-brand); color: var(--pb-brand-fg);'
              : ''}>
            {label}
          </button>
        {/each}
      </div>
    {/if}

    {#if view === 'tasks'}
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
      <div class="relative flex-1 min-h-0 overflow-y-auto" style="padding-bottom: var(--pb-canvas-slot-h, 0px);">
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
    {:else}
      <!-- Files view: open the selected course's files in the FilePreview
           viewer straight from the sidebar. -->
      <div class="px-3 py-2.5 border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div class="relative">
          <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            bind:value={filesSearch}
            placeholder="Search files…"
            class="w-full pl-8 pr-2.5 py-1.5 text-[11px] rounded-md bg-zinc-100/70 dark:bg-zinc-800/50 border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--pb-brand)] focus:bg-white dark:focus:bg-zinc-900 placeholder:text-zinc-400 transition-colors" />
        </div>
      </div>

      {#if filesLoading}
        <div class="py-16 text-center text-xs text-zinc-400">Loading files…</div>
      {:else if filesDisabled}
        <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div class="text-3xl mb-3">🔒</div>
          <p class="text-sm font-medium text-zinc-600 dark:text-zinc-400">Files unavailable</p>
          <p class="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
            This course has the Files section turned off, or you don't have access to it.
          </p>
        </div>
      {:else if filesError}
        <div class="p-4 text-xs text-red-500 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 m-3 rounded-lg border border-red-200/50 dark:border-red-900/30">
          Error: {filesError}
        </div>
      {:else if filteredFiles.length === 0}
        <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div class="text-3xl mb-3">📂</div>
          <p class="text-sm font-medium text-zinc-600 dark:text-zinc-400">{filesSearch ? 'No matches' : 'No files'}</p>
          <p class="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
            {filesSearch ? `Nothing matches "${filesSearch}".` : 'This course has no files.'}
          </p>
        </div>
      {:else}
        <div class="relative flex-1 min-h-0 overflow-y-auto" style="padding-bottom: var(--pb-canvas-slot-h, 0px);">
          {#each filteredFiles as f (f.id)}
            <button
              onclick={() => openFileInViewer(f.id)}
              class="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50 transition-colors border-b border-zinc-100/50 dark:border-zinc-800/30">
              <span class="text-base flex-shrink-0 leading-none">{fileIcon(f.display_name)}</span>
              <div class="min-w-0 flex-1">
                <div class="text-[12px] font-medium truncate">{f.display_name}</div>
                <div class="text-[10px] text-zinc-400 dark:text-zinc-500">{fmtSize(f.size)}</div>
              </div>
              <svg class="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          {/each}
          <div class="pointer-events-none sticky bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white dark:from-zinc-900 to-transparent"></div>
        </div>
      {/if}
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
