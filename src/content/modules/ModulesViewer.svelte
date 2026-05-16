<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchModulesFull } from './api';
  import { exportModules } from '../downloader/modules';
  import type { ModuleFull, ModuleItemFull } from '../../lib/types';

  let { courseId }: { courseId: number } = $props();

  let modules = $state<ModuleFull[]>([]);
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let collapsed = $state<Set<number>>(new Set());

  onMount(async () => {
    try {
      modules = await fetchModulesFull(courseId);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });

  function toggle(id: number) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id); else next.add(id);
    collapsed = next;
  }

  function collapseAll() { collapsed = new Set(modules.map(m => m.id)); }
  function expandAll() { collapsed = new Set(); }

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modules;
    return modules
      .map(m => ({
        ...m,
        items: (m.items ?? []).filter(i =>
          i.title.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q)
        )
      }))
      .filter(m => m.name.toLowerCase().includes(q) || (m.items ?? []).length > 0);
  });

  function itemHref(cid: number, item: ModuleItemFull): string {
    switch (item.type) {
      case 'File': return `/courses/${cid}/files/${item.content_id ?? ''}`;
      case 'Page': return `/courses/${cid}/pages/${item.page_url ?? ''}`;
      case 'Assignment': return `/courses/${cid}/assignments/${item.content_id ?? ''}`;
      case 'Quiz': return `/courses/${cid}/quizzes/${item.content_id ?? ''}`;
      case 'Discussion': return `/courses/${cid}/discussion_topics/${item.content_id ?? ''}`;
      case 'ExternalUrl':
      case 'ExternalTool':
        return item.external_url ?? item.html_url ?? '#';
      default: return item.html_url ?? '#';
    }
  }

  function itemIcon(type: ModuleItemFull['type']): string {
    return ({
      File: '📄', Page: '📝', Assignment: '✓', Quiz: '?',
      Discussion: '💬', ExternalUrl: '↗', ExternalTool: '↗', SubHeader: ''
    } as Record<string, string>)[type] ?? '•';
  }

  function statusPill(m: ModuleFull): { label: string; tone: string } | null {
    if (m.state === 'completed') return { label: 'Completed', tone: 'green' };
    if (m.state === 'started') return { label: 'In progress', tone: 'brand' };
    if (m.state === 'locked') return { label: 'Locked', tone: 'gray' };
    return null;
  }

  function fmtDue(iso?: string): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function isCompleted(item: ModuleItemFull): boolean {
    return !!item.completion_requirement?.completed;
  }
</script>

<div class="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
  <div class="max-w-3xl mx-auto px-6 py-8">
    <header class="mb-6 flex items-center justify-between gap-3 flex-wrap">
      <div class="min-w-0">
        <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-zinc-400 mb-2">
          <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
          Modules
          <span class="text-zinc-300 dark:text-zinc-700">·</span>
          <span>{filtered.length}</span>
        </div>
        <h1 class="text-2xl font-semibold tracking-tight">Modules</h1>
      </div>
      <button onclick={() => exportModules(courseId)}
              class="px-3 py-1.5 text-xs font-medium rounded-md active:scale-95 transition-transform flex items-center gap-1.5"
              style="background: var(--pb-brand); color: var(--pb-brand-fg);">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
        Export modules (.zip)
      </button>
    </header>

    <div class="flex items-center gap-2 mb-5">
      <div class="relative flex-1">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
        <input bind:value={search} placeholder="Search modules and items…"
               class="w-full pl-9 pr-3 py-1.5 text-xs rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-[var(--pb-brand)] focus:border-transparent placeholder:text-zinc-400" />
      </div>
      <button onclick={expandAll} class="px-2.5 py-1.5 text-[11px] rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/60">Expand all</button>
      <button onclick={collapseAll} class="px-2.5 py-1.5 text-[11px] rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/60">Collapse all</button>
    </div>

    {#if loading}
      <div class="py-16 text-center text-sm text-zinc-400">Loading modules…</div>
    {:else if error}
      <div class="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
    {:else if filtered.length === 0}
      <div class="py-16 text-center text-sm text-zinc-400">{search ? `No matches for "${search}".` : 'No modules in this course.'}</div>
    {:else}
      <div class="space-y-3">
        {#each filtered as m (m.id)}
          {@const pill = statusPill(m)}
          {@const isCollapsed = collapsed.has(m.id)}
          {@const items = m.items ?? []}
          <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <button onclick={() => toggle(m.id)}
                    class="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors text-left">
              <div class="flex items-center gap-2 min-w-0">
                <svg class={`w-3.5 h-3.5 transition-transform duration-200 text-zinc-400 ${isCollapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                <h3 class="text-sm font-semibold truncate">{m.name}</h3>
                <span class="text-[11px] text-zinc-400">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
              </div>
              {#if pill}
                <span class={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${pill.tone === 'green' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : pill.tone === 'gray' ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' : ''}`}
                      style={pill.tone === 'brand' ? 'background: var(--pb-brand-soft); color: var(--pb-brand-strong);' : ''}>
                  {pill.label}
                </span>
              {/if}
            </button>
            {#if !isCollapsed && items.length > 0}
              <div class="divide-y divide-zinc-100 dark:divide-zinc-800/60 border-t border-zinc-100 dark:border-zinc-800/60">
                {#each items as item (item.id)}
                  {#if item.type === 'SubHeader'}
                    <div class="px-4 py-2 text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-500 bg-zinc-50/50 dark:bg-zinc-950/30">{item.title}</div>
                  {:else}
                    {@const locked = !!item.content_details?.locked_for_user}
                    <a href={itemHref(courseId, item)}
                       class={`flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors ${locked ? 'opacity-50' : ''}`}
                       style={`padding-left: ${16 + (item.indent ?? 0) * 16}px`}>
                      <span class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex-shrink-0">
                        {itemIcon(item.type)}
                      </span>
                      <div class="min-w-0 flex-1">
                        <div class="text-sm truncate">{item.title}</div>
                        {#if item.content_details?.due_at || item.content_details?.points_possible}
                          <div class="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                            {#if item.content_details?.due_at}<span>Due {fmtDue(item.content_details.due_at)}</span>{/if}
                            {#if item.content_details?.due_at && item.content_details?.points_possible}<span>·</span>{/if}
                            {#if item.content_details?.points_possible}<span>{item.content_details.points_possible} pts</span>{/if}
                          </div>
                        {/if}
                      </div>
                      {#if isCompleted(item)}
                        <svg class="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {/if}
                      {#if locked}
                        <svg class="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 11c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1s-1-.45-1-1v-2c0-.55.45-1 1-1zm6-3V6c0-2.21-1.79-4-4-4h-4C7.79 2 6 3.79 6 6v2H4v14h16V8h-2zm-9-2c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2H9V6z"/></svg>
                      {/if}
                    </a>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
