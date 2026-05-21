<script lang="ts">
  // A dropdown for jumping between a course's pages (Home, Modules, Grades,
  // …) — the items from Canvas's left-hand course nav, surfaced inside the
  // Paintbrush sidebar instead of as a bar on every page.
  import { onMount } from 'svelte';
  import { fetchCourseTabs } from './api';
  import type { CourseTab } from '../../lib/types';

  let { courseId }: { courseId: number } = $props();

  let tabs = $state<CourseTab[]>([]);
  let open = $state(false);
  let rootEl: HTMLElement;

  const ICONS: Record<string, string> = {
    home: '🏠', modules: '🗂', assignments: '📝', discussions: '💬',
    grades: '📊', people: '👥', pages: '📄', files: '📁', syllabus: '📋',
    quizzes: '✓', announcements: '📣', outcomes: '🎯', rubrics: '📐',
    collaborations: '🤝', conferences: '🎥', settings: '⚙'
  };
  function iconFor(t: CourseTab): string {
    return ICONS[t.id] ?? (t.type === 'external' ? '🔗' : '•');
  }

  // The current page = the tab whose html_url is the longest prefix of the
  // path (so /modules/9 still resolves to Modules; bare /courses/X to Home).
  const path = typeof location !== 'undefined' ? location.pathname.replace(/\/+$/, '') : '';
  const activeTab = $derived.by(() => {
    let best: { tab: CourseTab; len: number } | null = null;
    for (const t of tabs) {
      const u = (t.html_url ?? '').replace(/\/+$/, '');
      if (!u) continue;
      if (path === u || path.startsWith(u + '/')) {
        if (!best || u.length > best.len) best = { tab: t, len: u.length };
      }
    }
    return best?.tab ?? null;
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
    open = false;
    if (t.html_url) location.href = t.html_url;
  }

  // Close on outside click / Escape. composedPath() is needed because the
  // sidebar lives in a shadow root, which retargets document-level events.
  $effect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootEl && !e.composedPath().includes(rootEl)) open = false;
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') open = false; };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  });
</script>

{#if tabs.length > 0}
  <div class="relative" bind:this={rootEl}>
    <button onclick={() => (open = !open)}
            class="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-[var(--pb-brand)] transition-colors text-left">
      <span class="text-sm flex-shrink-0 leading-none">{activeTab ? iconFor(activeTab) : '🧭'}</span>
      <div class="min-w-0 flex-1">
        <div class="text-[9px] uppercase tracking-[0.08em] text-zinc-400">Course page</div>
        <div class="text-[12px] font-semibold truncate">{activeTab ? activeTab.label : 'Go to…'}</div>
      </div>
      <svg class={`w-3.5 h-3.5 text-zinc-400 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
           fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    {#if open}
      <div class="absolute left-0 right-0 mt-1 z-[60] rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
        <div class="max-h-72 overflow-y-auto py-1">
          {#each tabs as t (t.id)}
            {@const active = activeTab?.id === t.id}
            <button onclick={() => go(t)}
                    class={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors ${active
                      ? ''
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                    style={active ? 'background: var(--pb-brand-soft);' : ''}>
              <span class="text-sm flex-shrink-0 leading-none">{iconFor(t)}</span>
              <span class={`text-[12px] truncate flex-1 ${active ? 'font-semibold' : 'font-medium'}`}
                    style={active ? 'color: var(--pb-brand-strong);' : ''}>{t.label}</span>
              {#if active}
                <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background: var(--pb-brand);"></span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}
