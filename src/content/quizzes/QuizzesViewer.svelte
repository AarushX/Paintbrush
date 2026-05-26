<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchQuizzes } from './api';
  import type { QuizFull } from '../../lib/types';

  let { courseId }: { courseId: number } = $props();

  let quizzes = $state<QuizFull[]>([]);
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let filter = $state<'all' | 'available' | 'upcoming' | 'past' | 'locked'>('all');

  onMount(async () => {
    try {
      quizzes = await fetchQuizzes(courseId);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });

  function now(): number {
    return Date.now();
  }

  function isAvailable(q: QuizFull): boolean {
    const t = now();
    const unlocked = !q.unlock_at || new Date(q.unlock_at).getTime() <= t;
    const notLocked = !q.lock_at || new Date(q.lock_at).getTime() > t;
    const notPast = !q.due_at || new Date(q.due_at).getTime() >= t;
    return !!q.due_at && unlocked && notLocked && notPast && !q.locked_for_user;
  }

  // Open right now but with no due date set — these would otherwise get
  // lumped in with deadline-bearing "Available now" quizzes; surfacing
  // them separately makes the lack of a deadline obvious.
  function isAnytime(q: QuizFull): boolean {
    if (q.locked_for_user || q.due_at) return false;
    const t = now();
    const unlocked = !q.unlock_at || new Date(q.unlock_at).getTime() <= t;
    const notLockedOut = !q.lock_at || new Date(q.lock_at).getTime() > t;
    return unlocked && notLockedOut;
  }

  function isUpcoming(q: QuizFull): boolean {
    const t = now();
    const lockedOut = q.unlock_at && new Date(q.unlock_at).getTime() > t;
    const dueFuture = q.due_at && new Date(q.due_at).getTime() > t;
    return !!(lockedOut || dueFuture) && !q.locked_for_user;
  }

  function isPast(q: QuizFull): boolean {
    if (!q.due_at) return false;
    return new Date(q.due_at).getTime() < now() && !q.locked_for_user;
  }

  function quizGroup(q: QuizFull): 'locked' | 'available' | 'anytime' | 'upcoming' | 'past' | 'other' {
    if (q.locked_for_user) return 'locked';
    if (isAnytime(q)) return 'anytime';
    if (isAvailable(q)) return 'available';
    if (isPast(q)) return 'past';
    if (isUpcoming(q)) return 'upcoming';
    return 'other';
  }

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    let list = quizzes;
    if (q) list = list.filter(qz => qz.title.toLowerCase().includes(q));
    if (filter === 'all') return list;
    return list.filter(qz => {
      if (filter === 'locked') return qz.locked_for_user;
      // "Available" includes anytime quizzes — both are open to take now.
      if (filter === 'available') return isAvailable(qz) || isAnytime(qz);
      if (filter === 'upcoming') return isUpcoming(qz);
      if (filter === 'past') return isPast(qz);
      return true;
    });
  });

  const grouped = $derived.by(() => {
    const available: QuizFull[] = [];
    const anytime: QuizFull[] = [];
    const upcoming: QuizFull[] = [];
    const past: QuizFull[] = [];
    const locked: QuizFull[] = [];
    const other: QuizFull[] = [];

    for (const q of filtered) {
      const g = quizGroup(q);
      if (g === 'available') available.push(q);
      else if (g === 'anytime') anytime.push(q);
      else if (g === 'upcoming') upcoming.push(q);
      else if (g === 'past') past.push(q);
      else if (g === 'locked') locked.push(q);
      else other.push(q);
    }
    return { available, anytime, upcoming, past, locked, other };
  });

  function fmtDue(iso: string | null): string {
    if (!iso) return 'No due date';
    const d = new Date(iso);
    const ms = d.getTime() - Date.now();
    const absH = Math.abs(ms) / 3_600_000;
    if (ms > 0 && absH < 24) return `Due in ${Math.round(absH)}h`;
    if (ms < 0 && absH < 24) return `Due ${Math.round(absH)}h ago`;
    return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function quizTypeBadge(q: QuizFull): { label: string; style: string } | null {
    if (q.quiz_type === 'practice_quiz') return { label: 'Practice', style: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' };
    if (q.quiz_type === 'survey') return { label: 'Survey', style: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' };
    if (q.quiz_type === 'graded_survey') return { label: 'Graded Survey', style: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' };
    return null;
  }

  const groupDefs: Array<{ key: keyof typeof grouped; label: string; dot: string; tone: string }> = [
    { key: 'available', label: 'Available now', dot: 'bg-emerald-500', tone: 'text-emerald-600 dark:text-emerald-400' },
    { key: 'anytime', label: 'Anytime · no due date', dot: 'bg-amber-400', tone: 'text-amber-600 dark:text-amber-400' },
    { key: 'upcoming', label: 'Upcoming', dot: 'bg-indigo-500', tone: 'text-indigo-600 dark:text-indigo-400' },
    { key: 'past', label: 'Past', dot: 'bg-zinc-400', tone: 'text-zinc-500 dark:text-zinc-400' },
    { key: 'locked', label: 'Locked', dot: 'bg-red-400', tone: 'text-red-500 dark:text-red-400' },
    { key: 'other', label: 'Other', dot: 'bg-zinc-300 dark:bg-zinc-600', tone: 'text-zinc-500 dark:text-zinc-400' }
  ];

  const filterChips: Array<{ value: typeof filter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'available', label: 'Available' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'past', label: 'Past' },
    { value: 'locked', label: 'Locked' }
  ];
</script>

<div class="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
  <div class="max-w-5xl mx-auto px-6 py-8">
    <header class="mb-6">
      <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-zinc-400 mb-2">
        <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
        Quizzes
        <span class="text-zinc-300 dark:text-zinc-700">·</span>
        <span>{filtered.length}</span>
      </div>
      <h1 class="text-2xl font-semibold tracking-tight">Quizzes</h1>
    </header>

    <!-- Toolbar -->
    <div class="flex items-center gap-2 mb-4 flex-wrap">
      <div class="relative flex-1 min-w-[180px]">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
        <input bind:value={search} placeholder="Search quizzes…"
               class="w-full pl-9 pr-3 py-1.5 text-xs rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-[var(--pb-brand)] focus:border-transparent placeholder:text-zinc-400" />
      </div>
    </div>

    <!-- Filter chips -->
    <div class="flex items-center gap-1.5 mb-5 flex-wrap">
      {#each filterChips as chip}
        <button
          onclick={() => filter = chip.value}
          class={`px-3 py-1 text-[11px] font-medium rounded-full border transition-colors ${filter === chip.value ? 'border-transparent' : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
          style={filter === chip.value ? 'background: var(--pb-brand); color: var(--pb-brand-fg);' : ''}>
          {chip.label}
        </button>
      {/each}
    </div>

    {#if loading}
      <div class="py-16 text-center text-sm text-zinc-400">Loading quizzes…</div>
    {:else if error}
      <div class="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
    {:else if filtered.length === 0}
      <div class="py-16 text-center text-sm text-zinc-400">{search ? `No matches for "${search}".` : 'No quizzes in this course.'}</div>
    {:else}
      {#each groupDefs as g}
        {#if grouped[g.key].length > 0}
          <div class={`flex items-center gap-1.5 mt-6 mb-2 ${g.tone}`}>
            <span class={`w-1.5 h-1.5 rounded-full ${g.dot}`}></span>
            <span class="text-[10px] font-semibold uppercase tracking-[0.08em]">{g.label}</span>
            <span class="text-zinc-400 text-[10px]">{grouped[g.key].length}</span>
          </div>
          <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-hidden">
            {#each grouped[g.key] as q (q.id)}
              {@const typeBadge = quizTypeBadge(q)}
              <a href={q.html_url}
                 class={`flex items-start justify-between gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors ${q.locked_for_user ? 'opacity-60' : ''}`}>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap mb-0.5">
                    <span class="text-sm font-medium truncate">{q.title}</span>
                    {#if typeBadge}
                      <span class={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${typeBadge.style}`}>{typeBadge.label}</span>
                    {/if}
                    {#if q.locked_for_user}
                      <svg class="w-3 h-3 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 11c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1s-1-.45-1-1v-2c0-.55.45-1 1-1zm6-3V6c0-2.21-1.79-4-4-4h-4C7.79 2 6 3.79 6 6v2H4v14h16V8h-2zm-9-2c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2H9V6z"/></svg>
                    {/if}
                  </div>
                  <div class="flex items-center gap-2 text-[11px] text-zinc-500 flex-wrap">
                    <span>{fmtDue(q.due_at)}</span>
                    {#if q.points_possible != null}
                      <span>·</span>
                      <span>{q.points_possible} pts</span>
                    {/if}
                    {#if q.question_count != null}
                      <span>·</span>
                      <span>{q.question_count} {q.question_count === 1 ? 'question' : 'questions'}</span>
                    {/if}
                    {#if q.time_limit}
                      <span>·</span>
                      <span>{q.time_limit} min limit</span>
                    {/if}
                    {#if q.allowed_attempts != null && q.allowed_attempts > 0}
                      <span>·</span>
                      <span>{q.allowed_attempts === -1 ? 'Unlimited' : q.allowed_attempts} {q.allowed_attempts === 1 ? 'attempt' : 'attempts'}</span>
                    {/if}
                  </div>
                </div>
                <span class={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                  g.key === 'available' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                  g.key === 'anytime' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                  g.key === 'upcoming' ? '' :
                  g.key === 'past' ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' :
                  g.key === 'locked' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
                style={g.key === 'upcoming' ? 'background: var(--pb-brand-soft); color: var(--pb-brand-strong);' : ''}>
                  {g.key === 'available' ? 'Open' : g.key === 'anytime' ? 'Anytime' : g.key === 'upcoming' ? 'Upcoming' : g.key === 'past' ? 'Closed' : g.key === 'locked' ? 'Locked' : 'Other'}
                </span>
              </a>
            {/each}
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</div>
