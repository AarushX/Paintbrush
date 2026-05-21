<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchAssignmentGroups } from './api';
  import type { AssignmentGroup, AssignmentListItem } from '../../lib/types';

  let { courseId }: { courseId: number } = $props();

  let groups = $state<AssignmentGroup[]>([]);
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let sortMode = $state<'due' | 'group'>('due');

  onMount(async () => {
    try {
      groups = await fetchAssignmentGroups(courseId);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });

  // Flatten all assignments
  const all = $derived(groups.flatMap(g => (g.assignments ?? []).map(a => ({ ...a, _groupName: g.name }))));

  // Search filter
  const filtered = $derived(
    search.trim()
      ? all.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
      : all
  );

  // Due-window grouping
  function daysFromNow(iso: string | null): number | null {
    if (!iso) return null;
    const due = new Date(iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(due);
    d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - today.getTime()) / 86_400_000);
  }

  const byDueWindow = $derived.by(() => {
    const buckets: Record<string, AssignmentListItem[]> = {
      pastDue: [], today: [], thisWeek: [], later: [], noDue: []
    };
    for (const a of filtered) {
      const days = daysFromNow(a.due_at);
      const submitted = a.has_submitted_submissions || a.submission?.workflow_state === 'submitted' || a.submission?.workflow_state === 'graded';
      if (days == null) buckets.noDue.push(a);
      else if (days < 0 && !submitted) buckets.pastDue.push(a);
      else if (days === 0) buckets.today.push(a);
      else if (days <= 7) buckets.thisWeek.push(a);
      else buckets.later.push(a);
    }
    return buckets;
  });

  function relativeDue(iso: string | null): string {
    if (!iso) return 'No due date';
    const d = new Date(iso);
    const ms = d.getTime() - Date.now();
    const absH = Math.abs(ms) / 3_600_000;
    if (ms > 0 && absH < 24) return `Due in ${Math.round(absH)}h`;
    if (ms < 0 && absH < 24) return `Due ${Math.round(absH)}h ago`;
    return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function statusBadge(a: AssignmentListItem): { label: string; tone: 'green' | 'brand' | 'red' | 'gray' | 'amber' } {
    const s = a.submission;
    if (!s) return { label: 'Not submitted', tone: 'gray' };
    if (s.excused) return { label: 'Excused', tone: 'gray' };
    if (s.workflow_state === 'graded') return { label: `${s.score ?? '–'}/${a.points_possible}`, tone: 'brand' };
    if (s.missing) return { label: 'Missing', tone: 'red' };
    if (s.late) return { label: 'Late', tone: 'amber' };
    if (s.workflow_state === 'submitted' || s.workflow_state === 'pending_review') return { label: 'Submitted', tone: 'green' };
    return { label: 'Not submitted', tone: 'gray' };
  }

  const groupOrder: Array<{ key: keyof typeof byDueWindow; label: string; dot: string; tone: string }> = [
    { key: 'pastDue', label: 'Past due', dot: 'bg-red-500', tone: 'text-red-600 dark:text-red-400' },
    { key: 'today', label: 'Today', dot: 'bg-indigo-500', tone: 'text-indigo-600 dark:text-indigo-400' },
    { key: 'thisWeek', label: 'This week', dot: 'bg-violet-500', tone: 'text-violet-600 dark:text-violet-400' },
    { key: 'later', label: 'Later', dot: 'bg-zinc-400', tone: 'text-zinc-500 dark:text-zinc-400' },
    { key: 'noDue', label: 'No due date', dot: 'bg-zinc-300 dark:bg-zinc-600', tone: 'text-zinc-500 dark:text-zinc-400' }
  ];
</script>

<div class="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
  <div class="max-w-5xl mx-auto px-6 py-8">
    <header class="mb-6">
      <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-zinc-400 mb-2">
        <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
        Assignments
        <span class="text-zinc-300 dark:text-zinc-700">·</span>
        <span>{filtered.length}</span>
      </div>
      <h1 class="text-2xl font-semibold tracking-tight">Assignments</h1>
    </header>

    <!-- Toolbar -->
    <div class="flex items-center gap-2 mb-5">
      <div class="relative flex-1">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
        <input bind:value={search} placeholder="Search assignments…"
               class="w-full pl-9 pr-3 py-1.5 text-xs rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-[var(--pb-brand)] focus:border-transparent placeholder:text-zinc-400" />
      </div>
      <div class="flex items-center text-[11px] rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <button class={`px-3 py-1.5 ${sortMode === 'due' ? '' : 'bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500'}`}
                style={sortMode === 'due' ? 'background: var(--pb-brand); color: var(--pb-brand-fg);' : ''}
                onclick={() => sortMode = 'due'}>By due</button>
        <button class={`px-3 py-1.5 ${sortMode === 'group' ? '' : 'bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500'}`}
                style={sortMode === 'group' ? 'background: var(--pb-brand); color: var(--pb-brand-fg);' : ''}
                onclick={() => sortMode = 'group'}>By group</button>
      </div>
    </div>

    {#if loading}
      <div class="py-16 text-center text-sm text-zinc-400">Loading assignments…</div>
    {:else if error}
      <div class="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
    {:else if filtered.length === 0}
      <div class="py-16 text-center text-sm text-zinc-400">{search ? `No matches for "${search}".` : 'No assignments in this course.'}</div>
    {:else if sortMode === 'due'}
      {#each groupOrder as g}
        {#if byDueWindow[g.key].length > 0}
          <div class={`flex items-center gap-1.5 mt-6 mb-2 ${g.tone}`}>
            <span class={`w-1.5 h-1.5 rounded-full ${g.dot}`}></span>
            <span class="text-[10px] font-semibold uppercase tracking-[0.08em]">{g.label}</span>
            <span class="text-zinc-400 text-[10px]">{byDueWindow[g.key].length}</span>
          </div>
          <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-hidden">
            {#each byDueWindow[g.key] as a (a.id)}
              {@const badge = statusBadge(a)}
              <a href={`/courses/${courseId}/assignments/${a.id}`}
                 class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium truncate">{a.name}</div>
                  <div class="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
                    <span>{relativeDue(a.due_at)}</span>
                    <span>·</span>
                    <span>{a.points_possible ?? 0} pts</span>
                  </div>
                </div>
                <span class={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${{
                  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                  gray: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
                  brand: ''
                }[badge.tone]}`}
                style={badge.tone === 'brand' ? 'background: var(--pb-brand-soft); color: var(--pb-brand-strong);' : ''}>
                  {badge.label}
                </span>
              </a>
            {/each}
          </div>
        {/if}
      {/each}
    {:else}
      {#each groups as g}
        {#if g.assignments && g.assignments.length > 0}
          {@const items = search.trim() ? g.assignments.filter(a => a.name.toLowerCase().includes(search.toLowerCase())) : g.assignments}
          {#if items.length > 0}
            <div class="flex items-center gap-1.5 mt-6 mb-2 text-zinc-500">
              <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
              <span class="text-[10px] font-semibold uppercase tracking-[0.08em]">{g.name}</span>
              <span class="text-zinc-400 text-[10px]">{items.length}</span>
            </div>
            <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-hidden">
              {#each items as a (a.id)}
                {@const badge = statusBadge(a)}
                <a href={`/courses/${courseId}/assignments/${a.id}`}
                   class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-medium truncate">{a.name}</div>
                    <div class="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
                      <span>{relativeDue(a.due_at)}</span>
                      <span>·</span>
                      <span>{a.points_possible ?? 0} pts</span>
                    </div>
                  </div>
                  <span class={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${{
                    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                    gray: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
                    brand: ''
                  }[badge.tone]}`}
                  style={badge.tone === 'brand' ? 'background: var(--pb-brand-soft); color: var(--pb-brand-strong);' : ''}>
                    {badge.label}
                  </span>
                </a>
              {/each}
            </div>
          {/if}
        {/if}
      {/each}
    {/if}
  </div>
</div>
