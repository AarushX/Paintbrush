<script lang="ts">
  import { onMount } from 'svelte';
  import {
    fetchDashboardCards, fetchSelf, fetchPlanner, fetchRecentAnnouncements, fetchCoursesWithScores
  } from './api';
  import type {
    DashboardCard, CanvasUserSelf, PlannerItem, Announcement, CourseWithScore
  } from '../../lib/types';

  let cards = $state<DashboardCard[]>([]);
  let self = $state<CanvasUserSelf | null>(null);
  let planner = $state<PlannerItem[]>([]);
  let announcements = $state<Announcement[]>([]);
  let coursesWithScores = $state<CourseWithScore[]>([]);
  let loading = $state(true);
  let error = $state('');

  onMount(async () => {
    try {
      const [s, c] = await Promise.all([
        fetchSelf().catch(() => null),
        fetchDashboardCards()
      ]);
      self = s;
      cards = c;
      // Now fetch planner + announcements + scores in parallel; non-fatal failures
      const courseIds = c.map(card => card.id);
      const [p, a, csc] = await Promise.all([
        fetchPlanner().catch(() => []),
        fetchRecentAnnouncements(courseIds).catch(() => []),
        fetchCoursesWithScores().catch(() => [])
      ]);
      planner = p;
      announcements = a;
      coursesWithScores = csc;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });

  function greeting(): string {
    const h = new Date().getHours();
    if (h < 5) return 'Welcome back';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 22) return 'Good evening';
    return 'Welcome back';
  }

  const firstName = $derived(self?.short_name?.split(/\s+/)[0] ?? self?.name?.split(/\s+/)[0] ?? '');

  const stats = $derived.by(() => {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 86_400_000);
    const dayAgo = new Date(now.getTime() - 86_400_000);

    let dueThisWeek = 0;
    let overdue = 0;
    for (const p of planner) {
      const d = new Date(p.plannable_date);
      const complete = !!p.planner_override?.marked_complete;
      if (complete) continue;
      if (d < now) overdue += 1;
      else if (d <= weekFromNow) dueThisWeek += 1;
    }
    const newSinceYesterday = announcements.filter(a =>
      a.posted_at && new Date(a.posted_at) >= dayAgo
    ).length;
    return {
      courses: cards.length,
      dueThisWeek,
      overdue,
      newSinceYesterday
    };
  });

  // Merge course scores into cards for the grade pill
  const scoreById = $derived(new Map(
    coursesWithScores.map(c => [c.id, c.enrollments?.[0]?.computed_current_score ?? null])
  ));

  function colorFor(card: DashboardCard): string {
    return card.color ?? 'var(--pb-brand)';
  }

  function relative(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    const ms = d.getTime() - Date.now();
    const absH = Math.abs(ms) / 3_600_000;
    if (Math.abs(ms) < 60_000) return 'now';
    if (ms > 0 && absH < 1) return 'in <1h';
    if (ms > 0 && absH < 24) return `in ${Math.round(absH)}h`;
    if (ms < 0 && absH < 24) return `${Math.round(absH)}h ago`;
    if (absH < 24 * 7) return d.toLocaleDateString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function previewHtml(html: string, max = 140): string {
    const t = (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max) + '…' : t;
  }

  function typeIcon(t: PlannerItem['plannable_type']): string {
    switch (t) {
      case 'assignment': return '📝';
      case 'quiz': return '✓';
      case 'discussion_topic': return '💬';
      case 'planner_note': return '📌';
      case 'announcement': return '📣';
      case 'wiki_page': return '📄';
      case 'calendar_event': return '📅';
      default: return '•';
    }
  }

  // Canvas's longName is just shortName + " - " + courseCode; we already render
  // the courseCode separately, so prefer originalName (the clean title) and fall
  // back to stripping the trailing code from longName.
  function displayName(card: DashboardCard): string {
    const candidate = card.originalName ?? card.shortName ?? card.longName ?? '';
    const code = card.courseCode ?? '';
    if (code && candidate.endsWith(' - ' + code)) {
      return candidate.slice(0, -(code.length + 3));
    }
    return candidate;
  }

  // Canvas often fills subtitle with "enrolled as: Student" — useless noise.
  // Show the term if present, otherwise drop it entirely.
  function displaySubtitle(card: DashboardCard): string {
    const s = (card.subtitle ?? '').trim();
    if (!s) return card.term ?? '';
    if (/^enrolled as\b/i.test(s)) return card.term ?? '';
    return s;
  }

  // Group planner items: Overdue / Today / Tomorrow / This week (next 7 days)
  const grouped = $derived.by(() => {
    const now = new Date();
    const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
    const today = startOfDay(now);
    const tomorrow = startOfDay(new Date(now.getTime() + 86_400_000));
    const sevenDays = startOfDay(new Date(now.getTime() + 7 * 86_400_000));

    const buckets: Record<'overdue' | 'today' | 'tomorrow' | 'week', PlannerItem[]> = {
      overdue: [], today: [], tomorrow: [], week: []
    };
    for (const p of planner) {
      if (p.planner_override?.marked_complete) continue;
      const due = new Date(p.plannable_date);
      const dueDay = startOfDay(due);
      if (due < now && dueDay < today) buckets.overdue.push(p);
      else if (dueDay.getTime() === today.getTime()) buckets.today.push(p);
      else if (dueDay.getTime() === tomorrow.getTime()) buckets.tomorrow.push(p);
      else if (dueDay <= sevenDays) buckets.week.push(p);
    }
    const sortAsc = (a: PlannerItem, b: PlannerItem) =>
      new Date(a.plannable_date).getTime() - new Date(b.plannable_date).getTime();
    buckets.overdue.sort(sortAsc);
    buckets.today.sort(sortAsc);
    buckets.tomorrow.sort(sortAsc);
    buckets.week.sort(sortAsc);
    return buckets;
  });

  const recentAnnouncements = $derived(
    [...announcements]
      .sort((a, b) => (b.posted_at ?? '').localeCompare(a.posted_at ?? ''))
      .slice(0, 5)
  );

  function courseNameById(id: number): string {
    return cards.find(c => c.id === id)?.shortName ?? '';
  }

  // Map announcement → course id via context_code parsing (Canvas adds context_code in many endpoints)
  function announcementCourseId(a: Announcement & { context_code?: string }): number | null {
    const cc = (a as any).context_code as string | undefined;
    if (!cc) return null;
    const m = cc.match(/course_(\d+)/);
    return m ? Number(m[1]) : null;
  }

  function colorForAnnouncement(a: Announcement): string {
    const cid = announcementCourseId(a as any);
    if (cid == null) return 'var(--pb-brand)';
    return cards.find(c => c.id === cid)?.color ?? 'var(--pb-brand)';
  }

  type BucketKey = 'overdue' | 'today' | 'tomorrow' | 'week';
  const bucketMeta: Array<[BucketKey, string, string]> = [
    ['overdue', 'Overdue', 'text-red-500'],
    ['today', 'Today', 'text-zinc-700 dark:text-zinc-300'],
    ['tomorrow', 'Tomorrow', 'text-zinc-700 dark:text-zinc-300'],
    ['week', 'This week', 'text-zinc-500']
  ];
</script>

<div class="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
  <div class="max-w-6xl mx-auto px-6 py-8">

    <!-- Header chip + greeting -->
    <header class="mb-8">
      <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-zinc-400 mb-2">
        <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
        Dashboard
      </div>
      <h1 class="text-3xl font-semibold tracking-tight">
        {greeting()}{firstName ? `, ${firstName}` : ''}
      </h1>
      <p class="text-sm text-zinc-500 mt-1">Here's what's on your plate.</p>
    </header>

    {#if loading}
      <!-- Skeleton loaders -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {#each Array(4) as _}
          <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 h-[88px] animate-pulse"></div>
        {/each}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each Array(6) as _}
          <div class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 h-[220px] animate-pulse"></div>
        {/each}
      </div>
    {:else if error}
      <div class="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
    {:else}

      <!-- Stat row -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div class="text-[10px] uppercase tracking-[0.08em] text-zinc-400 mb-1">Active courses</div>
          <div class="text-2xl font-semibold tabular-nums" style="color: var(--pb-brand-strong);">{stats.courses}</div>
        </div>
        <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div class="text-[10px] uppercase tracking-[0.08em] text-zinc-400 mb-1">Due this week</div>
          <div class="text-2xl font-semibold tabular-nums">{stats.dueThisWeek}</div>
        </div>
        <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 {stats.overdue > 0 ? 'ring-1 ring-red-200 dark:ring-red-900/40' : ''}">
          <div class="text-[10px] uppercase tracking-[0.08em] text-zinc-400 mb-1">Overdue</div>
          <div class="text-2xl font-semibold tabular-nums {stats.overdue > 0 ? 'text-red-600 dark:text-red-400' : ''}">{stats.overdue}</div>
        </div>
        <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div class="text-[10px] uppercase tracking-[0.08em] text-zinc-400 mb-1">New since yesterday</div>
          <div class="text-2xl font-semibold tabular-nums">{stats.newSinceYesterday}</div>
        </div>
      </div>

      <!-- Two-column: courses (left/main) + activity (right) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <!-- Course grid -->
        <section class="lg:col-span-2">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-500">Your courses</h2>
            <span class="text-[11px] text-zinc-400">{cards.length}</span>
          </div>
          {#if cards.length === 0}
            <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-12 text-center text-sm text-zinc-400">No active courses.</div>
          {:else}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {#each cards as card (card.id)}
                {@const score = scoreById.get(card.id)}
                {@const cc = colorFor(card)}
                <a href={card.href}
                   class="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all hover:-translate-y-0.5">
                  <div class="h-20 relative" style={`background-color: ${cc}; background-image: ${card.image ? `url('${card.image}')` : 'none'}; background-size: cover; background-position: center;`}>
                    <div class="absolute inset-0" style={`background: linear-gradient(135deg, ${cc}aa, transparent 70%);`}></div>
                    {#if score != null}
                      <div class="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-white/90 dark:bg-black/40 backdrop-blur-sm text-[11px] font-semibold" style="color: var(--pb-brand-strong);">
                        {score}%
                      </div>
                    {/if}
                  </div>
                  <div class="p-4">
                    <div class="text-[10px] uppercase tracking-[0.08em] text-zinc-400 mb-1 truncate">{card.courseCode}</div>
                    <h3 class="text-sm font-semibold leading-snug line-clamp-2">{displayName(card)}</h3>
                    {#if displaySubtitle(card)}
                      <div class="text-[11px] text-zinc-500 mt-0.5 truncate">{displaySubtitle(card)}</div>
                    {/if}
                    {#if card.links && card.links.length > 0}
                      <div class="flex items-center gap-1 mt-3">
                        {#each card.links.filter(l => !l.hidden).slice(0, 4) as link}
                          <button
                             type="button"
                             onclick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = link.path; }}
                             class="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded text-zinc-500 hover:text-[var(--pb-brand-strong)] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                             title={link.label}>
                            {link.label.slice(0, 4)}
                          </button>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </a>
              {/each}
            </div>
          {/if}
        </section>

        <!-- Activity column -->
        <aside class="lg:col-span-1 space-y-6">

          <!-- Up next -->
          <section>
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-500">Up next</h2>
              {#if planner.length > 0}<span class="text-[11px] text-zinc-400">{planner.filter(p => !p.planner_override?.marked_complete).length}</span>{/if}
            </div>
            {#if grouped.overdue.length + grouped.today.length + grouped.tomorrow.length + grouped.week.length === 0}
              <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-10 text-center text-xs text-zinc-400">Nothing coming up 🌴</div>
            {:else}
              <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-hidden">
                {#each bucketMeta as [key, label, tone]}
                  {#if grouped[key].length > 0}
                    <div class="px-3 py-1.5 bg-zinc-50/50 dark:bg-zinc-950/30 flex items-center gap-1.5">
                      <span class="text-[9px] font-semibold uppercase tracking-[0.08em] {tone}">{label}</span>
                      <span class="text-[10px] text-zinc-400">{grouped[key].length}</span>
                    </div>
                    {#each grouped[key].slice(0, 5) as it (it.plannable_id + ':' + it.plannable_type)}
                      <a href={it.html_url} class="flex items-start gap-2 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                        <span class="text-sm leading-none mt-0.5">{typeIcon(it.plannable_type)}</span>
                        <div class="min-w-0 flex-1">
                          <div class="text-xs font-medium truncate">{it.plannable.title ?? it.plannable.name ?? 'Untitled'}</div>
                          <div class="text-[10px] text-zinc-500 truncate">
                            {it.context_name ?? ''}{it.context_name && it.plannable_date ? ' · ' : ''}{relative(it.plannable_date)}
                          </div>
                        </div>
                      </a>
                    {/each}
                  {/if}
                {/each}
              </div>
            {/if}
          </section>

          <!-- Recent announcements -->
          <section>
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-500">Recent announcements</h2>
              {#if recentAnnouncements.length > 0}<span class="text-[11px] text-zinc-400">{recentAnnouncements.length}</span>{/if}
            </div>
            {#if recentAnnouncements.length === 0}
              <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-10 text-center text-xs text-zinc-400">No recent announcements.</div>
            {:else}
              <div class="space-y-2">
                {#each recentAnnouncements as a (a.id)}
                  {@const cid = announcementCourseId(a as any)}
                  <a href={cid != null ? `/courses/${cid}/discussion_topics/${a.id}` : (a.html_url ?? '#')}
                     class="block rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                    <div class="flex items-center gap-1.5 mb-1">
                      <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style={`background: ${colorForAnnouncement(a)};`}></span>
                      <span class="text-[10px] uppercase tracking-wider text-zinc-400 truncate">{cid != null ? courseNameById(cid) : ''}</span>
                      <span class="text-[10px] text-zinc-400 ml-auto flex-shrink-0">{relative(a.posted_at)}</span>
                    </div>
                    <h3 class="text-xs font-medium leading-snug mb-1 line-clamp-2">{a.title}</h3>
                    <p class="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">{previewHtml(a.message ?? '')}</p>
                  </a>
                {/each}
              </div>
            {/if}
          </section>
        </aside>
      </div>
    {/if}
  </div>
</div>
