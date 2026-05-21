<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchCourseScores, fetchAssignmentGroupsWithSubmissions } from './api';
  import type { CourseWithMeta, AssignmentGroupWithScores, AssignmentListItem } from '../../lib/types';

  let { courseId }: { courseId: number } = $props();

  let course = $state<CourseWithMeta | null>(null);
  let groups = $state<AssignmentGroupWithScores[]>([]);
  let loading = $state(true);
  let error = $state('');

  let whatIf = $state(false);
  let overrides = $state<Record<number, number | null>>({});

  let filter = $state<'all' | 'graded' | 'submitted' | 'missing' | 'late'>('all');
  let sortBy = $state<'due' | 'score' | 'name' | 'group'>('due');

  onMount(async () => {
    try {
      const [c, g] = await Promise.all([
        fetchCourseScores(courseId),
        fetchAssignmentGroupsWithSubmissions(courseId)
      ]);
      course = c;
      groups = g;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });

  const apiCurrent = $derived(course?.enrollments?.[0]?.computed_current_score ?? null);
  const apiCurrentGrade = $derived(course?.enrollments?.[0]?.computed_current_grade ?? null);

  function effectiveScore(a: AssignmentListItem): number | null {
    if (whatIf && a.id in overrides) {
      const v = overrides[a.id];
      return v == null ? null : v;
    }
    const s = a.submission;
    if (!s || s.excused) return null;
    return s.score ?? null;
  }

  function isCounted(a: AssignmentListItem): boolean {
    if (a.submission?.excused) return false;
    if (a.points_possible == null || a.points_possible === 0) return false;
    return effectiveScore(a) != null;
  }

  const groupStats = $derived.by(() => {
    return groups.map(g => {
      let earned = 0, total = 0, count = 0;
      for (const a of g.assignments ?? []) {
        if (!isCounted(a)) continue;
        earned += effectiveScore(a) ?? 0;
        total += a.points_possible ?? 0;
        count += 1;
      }
      const pct = total > 0 ? (earned / total) * 100 : null;
      return { group: g, earned, total, pct, count };
    });
  });

  const overallPct = $derived.by(() => {
    if (groups.length === 0) return null;
    if (course?.apply_assignment_group_weights) {
      let weighted = 0, weightUsed = 0;
      for (const s of groupStats) {
        if (s.pct == null || !s.group.group_weight) continue;
        weighted += s.pct * (s.group.group_weight / 100);
        weightUsed += s.group.group_weight / 100;
      }
      return weightUsed > 0 ? weighted / weightUsed : null;
    }
    let earned = 0, total = 0;
    for (const s of groupStats) { earned += s.earned; total += s.total; }
    return total > 0 ? (earned / total) * 100 : null;
  });

  function letterGrade(pct: number | null): string {
    if (pct == null) return '—';
    if (pct >= 93) return 'A';
    if (pct >= 90) return 'A-';
    if (pct >= 87) return 'B+';
    if (pct >= 83) return 'B';
    if (pct >= 80) return 'B-';
    if (pct >= 77) return 'C+';
    if (pct >= 73) return 'C';
    if (pct >= 70) return 'C-';
    if (pct >= 67) return 'D+';
    if (pct >= 63) return 'D';
    if (pct >= 60) return 'D-';
    return 'F';
  }

  const allAssignments = $derived(
    groups.flatMap(g => (g.assignments ?? []).map(a => ({ ...a, _groupName: g.name, _groupId: g.id })))
  );

  function status(a: AssignmentListItem): { label: string; tone: string } {
    const s = a.submission;
    if (!s) return { label: 'Not yet', tone: 'gray' };
    if (s.excused) return { label: 'Excused', tone: 'gray' };
    if (s.workflow_state === 'graded') return { label: 'Graded', tone: 'brand' };
    if (s.missing) return { label: 'Missing', tone: 'red' };
    if (s.late) return { label: 'Late', tone: 'amber' };
    if (s.workflow_state === 'submitted' || s.workflow_state === 'pending_review') return { label: 'Submitted', tone: 'blue' };
    return { label: 'Not yet', tone: 'gray' };
  }

  const filtered = $derived.by(() => {
    let list = allAssignments;
    if (filter === 'graded') list = list.filter(a => a.submission?.workflow_state === 'graded');
    else if (filter === 'submitted') list = list.filter(a => a.submission?.workflow_state === 'submitted' || a.submission?.workflow_state === 'pending_review');
    else if (filter === 'missing') list = list.filter(a => a.submission?.missing);
    else if (filter === 'late') list = list.filter(a => a.submission?.late);
    const sorted = [...list];
    if (sortBy === 'due') sorted.sort((a, b) => (a.due_at ?? 'zzz').localeCompare(b.due_at ?? 'zzz'));
    else if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'group') sorted.sort((a, b) => ((a as any)._groupName).localeCompare((b as any)._groupName));
    else if (sortBy === 'score') sorted.sort((a, b) => {
      const sa = effectiveScore(a) ?? -1, sb = effectiveScore(b) ?? -1;
      return sb - sa;
    });
    return sorted;
  });

  function fmtScore(a: AssignmentListItem): string {
    const score = effectiveScore(a);
    const max = a.points_possible ?? 0;
    if (score == null) return `–/${max}`;
    return `${score}/${max}`;
  }

  function fmtDue(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function setOverride(id: number, val: string) {
    const num = val.trim() === '' ? null : Number(val);
    overrides = { ...overrides, [id]: Number.isFinite(num as number) ? (num as number) : null };
  }

  function clearOverrides() {
    overrides = {};
  }
</script>

<div class="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
  <div class="max-w-5xl mx-auto px-6 py-8">
    <header class="mb-6">
      <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-zinc-400 mb-2">
        <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
        Grades
        {#if course}<span class="text-zinc-300 dark:text-zinc-700">·</span><span>{course.course_code ?? course.name}</span>{/if}
      </div>
      <h1 class="text-2xl font-semibold tracking-tight">Grades</h1>
    </header>

    {#if loading}
      <div class="py-16 text-center text-sm text-zinc-400">Loading grades…</div>
    {:else if error}
      <div class="rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
    {:else}
      <!-- Hero -->
      <div class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 mb-6 flex items-center gap-6">
        <div class="flex-shrink-0">
          <div class="text-[10px] uppercase tracking-[0.08em] text-zinc-400 mb-1">{whatIf ? 'What-if total' : 'Current'}</div>
          <div class="text-5xl font-semibold tracking-tight" style="color: var(--pb-brand-strong);">
            {overallPct != null ? overallPct.toFixed(1) : '—'}<span class="text-2xl text-zinc-400">%</span>
          </div>
          <div class="text-sm font-medium text-zinc-600 dark:text-zinc-400 mt-1">{letterGrade(overallPct)}</div>
        </div>
        <div class="flex-1">
          {#if apiCurrent != null}
            <div class="text-[11px] text-zinc-500">Canvas reports <span class="font-medium text-zinc-700 dark:text-zinc-300">{apiCurrent}{apiCurrentGrade ? ` (${apiCurrentGrade})` : ''}</span></div>
          {/if}
          {#if course?.apply_assignment_group_weights}
            <div class="text-[11px] text-zinc-500 mt-1">Course uses weighted assignment groups.</div>
          {/if}
          <label class="mt-3 flex items-center gap-2 cursor-pointer text-xs">
            <input type="checkbox" bind:checked={whatIf} class="rounded" />
            What-if calculator
          </label>
          {#if whatIf && Object.keys(overrides).length > 0}
            <button onclick={clearOverrides} class="mt-1 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline">Reset overrides</button>
          {/if}
        </div>
      </div>

      <!-- Group breakdown -->
      {#if groupStats.length > 0}
        <div class="mb-6">
          <div class="text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-500 mb-2">By group</div>
          <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-hidden">
            {#each groupStats as gs (gs.group.id)}
              <div class="px-4 py-3">
                <div class="flex items-baseline justify-between gap-3 mb-2">
                  <div class="flex items-baseline gap-2 min-w-0">
                    <span class="text-sm font-medium truncate">{gs.group.name}</span>
                    {#if course?.apply_assignment_group_weights && gs.group.group_weight}
                      <span class="text-[10px] text-zinc-400">{gs.group.group_weight}%</span>
                    {/if}
                  </div>
                  <div class="text-sm font-medium" style="color: var(--pb-brand-strong);">
                    {gs.pct != null ? `${gs.pct.toFixed(1)}%` : '—'} <span class="text-[11px] text-zinc-400">({gs.earned}/{gs.total})</span>
                  </div>
                </div>
                <div class="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div class="h-full transition-all duration-300" style={`width: ${Math.min(100, Math.max(0, gs.pct ?? 0))}%; background: var(--pb-brand);`}></div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Filters + sort -->
      <div class="flex items-center gap-2 mb-3 flex-wrap">
        <div class="flex items-center text-[11px] rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {#each ([['all','All'],['graded','Graded'],['submitted','Submitted'],['missing','Missing'],['late','Late']] as const) as [v, label]}
            <button class={`px-2.5 py-1.5 ${filter === v ? '' : 'bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500'}`}
                    style={filter === v ? 'background: var(--pb-brand); color: var(--pb-brand-fg);' : ''}
                    onclick={() => filter = v}>{label}</button>
          {/each}
        </div>
        <select bind:value={sortBy} class="ml-auto px-2.5 py-1.5 text-[11px] rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <option value="due">Sort: Due</option>
          <option value="name">Sort: Name</option>
          <option value="group">Sort: Group</option>
          <option value="score">Sort: Score</option>
        </select>
      </div>

      <!-- Assignment table -->
      <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-zinc-50 dark:bg-zinc-950/30 text-[10px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th class="text-left px-4 py-2 font-semibold">Assignment</th>
              <th class="text-left px-2 py-2 font-semibold w-[80px]">Due</th>
              <th class="text-right px-2 py-2 font-semibold w-[100px]">Score</th>
              <th class="text-right px-4 py-2 font-semibold w-[100px]">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {#each filtered as a (a.id)}
              {@const st = status(a)}
              <tr class="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                <td class="px-4 py-2.5">
                  <a href={`/courses/${courseId}/assignments/${a.id}`} class="text-sm font-medium hover:underline truncate block max-w-[280px]">{a.name}</a>
                  <div class="text-[10px] text-zinc-500 mt-0.5">{(a as any)._groupName}</div>
                </td>
                <td class="px-2 py-2.5 text-[11px] text-zinc-500 whitespace-nowrap">{fmtDue(a.due_at)}</td>
                <td class="px-2 py-2.5 text-right whitespace-nowrap">
                  {#if whatIf}
                    <input type="number" step="0.5" min="0" max={a.points_possible}
                           value={effectiveScore(a) ?? ''}
                           oninput={(e) => setOverride(a.id, (e.currentTarget as HTMLInputElement).value)}
                           class="w-14 px-1.5 py-0.5 text-xs text-right rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950" />
                    <span class="text-[11px] text-zinc-500">/{a.points_possible ?? 0}</span>
                  {:else}
                    <span class="text-sm tabular-nums">{fmtScore(a)}</span>
                  {/if}
                </td>
                <td class="px-4 py-2.5 text-right">
                  <span class={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap inline-block ${{
                    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                    gray: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
                    brand: ''
                  }[st.tone]}`}
                  style={st.tone === 'brand' ? 'background: var(--pb-brand-soft); color: var(--pb-brand-strong);' : ''}>
                    {st.label}
                  </span>
                </td>
              </tr>
            {/each}
            {#if filtered.length === 0}
              <tr><td colspan="4" class="py-12 text-center text-sm text-zinc-400">No assignments match the current filter.</td></tr>
            {/if}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
