<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchCollaborations } from './api';
  import type { Collaboration } from './api';

  let { courseId }: { courseId: number } = $props();

  let items = $state<Collaboration[]>([]);
  let loading = $state(true);
  let error = $state('');

  onMount(async () => {
    try {
      items = await fetchCollaborations(courseId);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });

  function kindOf(c: Collaboration): string {
    const t = (c.collaboration_type ?? c.type ?? '').toLowerCase();
    if (t.includes('google')) return 'Google Docs';
    if (t.includes('microsoft') || t.includes('office')) return 'Microsoft 365';
    if (t.includes('etherpad')) return 'EtherPad';
    return c.collaboration_type ?? c.type ?? 'Collaboration';
  }
  function iconOf(c: Collaboration): string {
    const k = kindOf(c).toLowerCase();
    if (k.includes('google')) return '📄';
    if (k.includes('microsoft')) return '📘';
    return '🤝';
  }
  function fmtDate(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<div class="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
  <div class="max-w-5xl mx-auto px-6 py-8">
    <header class="mb-6">
      <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-zinc-400 mb-2">
        <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
        Collaborations
        {#if !loading && !error}
          <span class="text-zinc-300 dark:text-zinc-700">·</span>
          <span>{items.length}</span>
        {/if}
      </div>
      <h1 class="text-2xl font-semibold tracking-tight">Collaborations</h1>
      <p class="text-sm text-zinc-500 mt-1">Shared documents for this course.</p>
    </header>

    {#if loading}
      <div class="py-16 text-center text-sm text-zinc-400">Loading collaborations…</div>
    {:else if error}
      <div class="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
    {:else if items.length === 0}
      <div class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-14 text-center">
        <div class="text-4xl mb-3">🤝</div>
        <h2 class="text-base font-semibold mb-1">No collaborations</h2>
        <p class="text-sm text-zinc-500 dark:text-zinc-400">This course has no shared collaboration documents.</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {#each items as c (c.id)}
          <a href={c.url ?? `/courses/${courseId}/collaborations`}
             target={c.url ? '_blank' : undefined}
             rel="noopener"
             class="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex gap-3 hover:border-[var(--pb-brand)] hover:shadow-md transition-all">
            <span class="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                  style="background: var(--pb-brand-soft);">{iconOf(c)}</span>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold leading-snug line-clamp-2">{c.title || 'Untitled collaboration'}</div>
              <div class="text-[11px] text-zinc-400 mt-0.5">
                {kindOf(c)}{c.created_at ? ` · ${fmtDate(c.created_at)}` : ''}
              </div>
              {#if c.description}
                <p class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 line-clamp-2">{c.description}</p>
              {/if}
              {#if c.user_name}
                <div class="text-[11px] text-zinc-400 mt-1.5">by {c.user_name}</div>
              {/if}
            </div>
            <svg class="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0 group-hover:text-[var(--pb-brand)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>
