<script lang="ts">
  // Course navigation for the Paintbrush sidebar: the course's native
  // Canvas pages (Home, Modules, Grades, …) as a row of chips, plus a
  // separate dropdown for external tools / links (Zoom, Ed Discussion, …).
  import { onMount } from 'svelte';
  import { fetchCourseTabs } from './api';
  import type { CourseTab } from '../../lib/types';

  let { courseId, live = false }: { courseId: number; live?: boolean } = $props();

  let tabs = $state<CourseTab[]>([]);
  let toolsOpen = $state(false);
  let toolsRoot: HTMLElement;

  const ICONS: Record<string, string> = {
    home: '🏠', modules: '🗂', assignments: '📝', discussions: '💬',
    grades: '📊', people: '👥', pages: '📄', files: '📁', syllabus: '📋',
    quizzes: '✓', announcements: '📣', outcomes: '🎯', rubrics: '📐',
    collaborations: '🤝', conferences: '🎥', settings: '⚙'
  };
  function iconFor(t: CourseTab): string {
    return ICONS[t.id] ?? (isExternal(t) ? '🔗' : '•');
  }

  // External tools vs. Canvas-native sections.
  function isExternal(t: CourseTab): boolean {
    return t.type === 'external' || t.id.startsWith('context_external_tool');
  }

  const nativeTabs = $derived(tabs.filter(t => !isExternal(t)));
  const externalTabs = $derived(tabs.filter(isExternal));

  // Highlight the page you're actually on — only when this is the course
  // currently open (the picker may point at a different course).
  const path = typeof location !== 'undefined' ? location.pathname.replace(/\/+$/, '') : '';
  const activeId = $derived.by(() => {
    if (!live) return null;
    let best: { id: string; len: number } | null = null;
    for (const t of tabs) {
      const u = (t.html_url ?? '').replace(/\/+$/, '');
      if (!u) continue;
      if (path === u || path.startsWith(u + '/')) {
        if (!best || u.length > best.len) best = { id: t.id, len: u.length };
      }
    }
    return best?.id ?? null;
  });

  onMount(async () => {
    try {
      const list = await fetchCourseTabs(courseId);
      tabs = list
        .filter(t => !t.hidden && !!t.html_url)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    } catch {
      tabs = [];
    }
  });

  function go(t: CourseTab) {
    toolsOpen = false;
    if (t.html_url) location.href = t.html_url;
  }

  // Close the tools dropdown on outside click / Escape. composedPath() is
  // required because the sidebar lives in a shadow root.
  $effect(() => {
    if (!toolsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (toolsRoot && !e.composedPath().includes(toolsRoot)) toolsOpen = false;
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') toolsOpen = false; };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  });
</script>

{#if nativeTabs.length > 0}
  <div class="flex flex-wrap gap-1">
    {#each nativeTabs as t (t.id)}
      {@const active = t.id === activeId}
      <a href={t.html_url} title={t.label}
         class={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all duration-150 active:scale-95 ${active
           ? 'shadow-sm'
           : 'bg-zinc-100/70 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60'}`}
         style={active ? 'background: var(--pb-brand); color: var(--pb-brand-fg);' : ''}>
        <span class="text-[10px] leading-none">{iconFor(t)}</span>
        {t.label}
      </a>
    {/each}
  </div>
{/if}

{#if externalTabs.length > 0}
  <div class="relative" bind:this={toolsRoot}>
    <button onclick={() => (toolsOpen = !toolsOpen)}
            class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-[var(--pb-brand)] transition-colors text-left">
      <span class="text-sm flex-shrink-0 leading-none">🧩</span>
      <span class="flex-1 text-[12px] font-medium">Tools &amp; links</span>
      <span class="text-[10px] text-zinc-400">{externalTabs.length}</span>
      <svg class={`w-3.5 h-3.5 text-zinc-400 flex-shrink-0 transition-transform duration-150 ${toolsOpen ? 'rotate-180' : ''}`}
           fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    {#if toolsOpen}
      <div class="absolute left-0 right-0 mt-1 z-[60] rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
        <div class="max-h-72 overflow-y-auto py-1">
          {#each externalTabs as t (t.id)}
            <button onclick={() => go(t)}
                    class="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
              <span class="text-sm flex-shrink-0 leading-none">{iconFor(t)}</span>
              <span class="text-[12px] font-medium truncate flex-1">{t.label}</span>
              <svg class="w-3 h-3 text-zinc-300 dark:text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}
