<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchCourseTabs } from './api';
  import type { CourseTab } from '../../lib/types';

  let { courseId }: { courseId: number } = $props();

  let tabs = $state<CourseTab[]>([]);
  let loading = $state(true);
  let scroller = $state<HTMLElement | null>(null);

  // Emoji glyphs for the well-known Canvas course tabs; external tools and
  // anything unrecognised fall back to a generic mark.
  const ICONS: Record<string, string> = {
    home: '🏠', modules: '🗂', assignments: '📝', discussions: '💬',
    grades: '📊', people: '👥', pages: '📄', files: '📁', syllabus: '📋',
    quizzes: '✓', announcements: '📣', outcomes: '🎯', rubrics: '📐',
    collaborations: '🤝', conferences: '🎥', settings: '⚙'
  };
  function iconFor(t: CourseTab): string {
    return ICONS[t.id] ?? (t.type === 'external' ? '🔗' : '•');
  }

  // Active tab = the one whose html_url is the longest prefix of the current
  // path, so /courses/X/modules/9 still highlights Modules while the bare
  // /courses/X only ever matches Home.
  const path = typeof location !== 'undefined' ? location.pathname.replace(/\/+$/, '') : '';
  const activeId = $derived.by(() => {
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
    } finally {
      loading = false;
    }
  });

  // Once rendered, scroll the active tab into view in the overflow row.
  $effect(() => {
    if (!scroller || tabs.length === 0) return;
    const el = scroller.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ inline: 'center', block: 'nearest' });
  });
</script>

{#if loading || tabs.length > 0}
  <nav class="sticky top-0 z-30 relative bg-white/70 dark:bg-zinc-950/65 backdrop-blur-xl backdrop-saturate-150 border-b border-zinc-200/60 dark:border-zinc-800/60">
    <!-- liquid-glass top sheen -->
    <div class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/15 to-transparent"></div>
    <div bind:this={scroller}
         class="pb-nav-scroll max-w-3xl mx-auto flex items-center gap-1 px-3 py-2 overflow-x-auto">
      {#if loading}
        {#each Array(7) as _}
          <div class="h-[30px] w-20 rounded-full bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse flex-shrink-0"></div>
        {/each}
      {:else}
        {#each tabs as t (t.id)}
          {@const active = t.id === activeId}
          <a href={t.html_url}
             data-active={active ? 'true' : null}
             title={t.label}
             class={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all duration-150 active:scale-95 ${active
               ? 'shadow-sm'
               : 'text-zinc-600 dark:text-zinc-300 hover:bg-black/[0.05] dark:hover:bg-white/10'}`}
             style={active ? 'background: var(--pb-brand); color: var(--pb-brand-fg); box-shadow: 0 2px 8px color-mix(in srgb, var(--pb-brand) 35%, transparent);' : ''}>
            <span class="text-[11px] leading-none">{iconFor(t)}</span>
            {t.label}
          </a>
        {/each}
      {/if}
    </div>
  </nav>
{/if}

<style>
  /* Hide the horizontal scrollbar — the row still scrolls. */
  .pb-nav-scroll { scrollbar-width: none; -ms-overflow-style: none; }
  .pb-nav-scroll::-webkit-scrollbar { display: none; }
</style>
