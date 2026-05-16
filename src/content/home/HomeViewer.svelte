<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchCourseFull, fetchUpcomingAssignments, fetchRecentAnnouncements } from './api';
  import { exportEntireCourse } from '../downloader/course';
  import type { CourseWithMeta, AssignmentListItem, Announcement } from '../../lib/types';

  let { courseId }: { courseId: number } = $props();

  let course = $state<CourseWithMeta | null>(null);
  let upcoming = $state<AssignmentListItem[]>([]);
  let announcements = $state<Announcement[]>([]);
  let loading = $state(true);
  let error = $state('');

  onMount(async () => {
    try {
      const [c, u, a] = await Promise.all([
        fetchCourseFull(courseId),
        fetchUpcomingAssignments(courseId).catch(() => [] as AssignmentListItem[]),
        fetchRecentAnnouncements(courseId).catch(() => [] as Announcement[])
      ]);
      course = c;
      upcoming = u.sort((x, y) => (x.due_at ?? 'z').localeCompare(y.due_at ?? 'z')).slice(0, 5);
      announcements = a.sort((x, y) => (y.posted_at ?? '').localeCompare(x.posted_at ?? '')).slice(0, 3);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });

  const currentGrade = $derived(course?.enrollments?.[0]?.computed_current_score);
  const nextDue = $derived(upcoming[0]);
  const latestAnnouncement = $derived(announcements[0]);

  function relative(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    const ms = d.getTime() - Date.now();
    const absH = Math.abs(ms) / 3_600_000;
    if (Math.abs(ms) < 60_000) return 'now';
    if (ms > 0 && absH < 24) return `in ${Math.round(absH)}h`;
    if (ms < 0 && absH < 24) return `${Math.round(absH)}h ago`;
    if (absH < 24 * 7) return `${Math.round(absH / 24)}d ${ms > 0 ? '' : 'ago'}`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function relativePast(iso?: string): string {
    if (!iso) return '';
    return relative(iso);
  }

  function preview(html: string, max = 160): string {
    const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max) + '…' : t;
  }

  const quickLinks = [
    { label: 'Modules', href: 'modules' },
    { label: 'Grades', href: 'grades' },
    { label: 'Assignments', href: 'assignments' },
    { label: 'Discussions', href: 'discussion_topics' },
    { label: 'People', href: 'users' },
    { label: 'Files', href: 'files' },
    { label: 'Syllabus', href: 'assignments/syllabus' }
  ];
</script>

<div class="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
  <div class="max-w-3xl mx-auto px-6 py-8">
    {#if loading && !course}
      <div class="py-16 text-center text-sm text-zinc-400">Loading course…</div>
    {:else if error}
      <div class="rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
    {:else if course}
      <!-- Hero -->
      <header class="mb-6 pb-6 border-b border-zinc-200 dark:border-zinc-800/50">
        {#if course.image_download_url}
          <div class="rounded-xl mb-4 h-32 bg-cover bg-center relative overflow-hidden" style={`background-image: url('${course.image_download_url}'); box-shadow: inset 0 -40px 40px -20px color-mix(in srgb, var(--pb-brand) 30%, transparent);`}>
            <div class="absolute inset-0" style="background: linear-gradient(135deg, color-mix(in srgb, var(--pb-brand) 20%, transparent), transparent 60%);"></div>
          </div>
        {/if}
        <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-zinc-400 mb-2">
          <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
          {course.course_code ?? 'Course'}
          {#if course.term?.name}<span class="text-zinc-300 dark:text-zinc-700">·</span><span>{course.term.name}</span>{/if}
        </div>
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <h1 class="text-2xl font-semibold tracking-tight">{course.name}</h1>
          <button onclick={() => exportEntireCourse(courseId)}
                  class="px-3 py-1.5 text-xs font-medium rounded-md active:scale-95 transition-transform flex items-center gap-1.5 flex-shrink-0"
                  style="background: var(--pb-brand); color: var(--pb-brand-fg);">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
            Export entire course (.zip)
          </button>
        </div>
      </header>

      <!-- Stats grid -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div class="text-[10px] uppercase tracking-[0.08em] text-zinc-400 mb-1">Grade</div>
          <div class="text-xl font-semibold" style="color: var(--pb-brand-strong);">
            {currentGrade != null ? `${currentGrade}%` : '—'}
          </div>
        </div>
        <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div class="text-[10px] uppercase tracking-[0.08em] text-zinc-400 mb-1">Next due</div>
          <div class="text-sm font-medium truncate">{nextDue ? nextDue.name : '—'}</div>
          <div class="text-[11px] text-zinc-500 mt-0.5">{nextDue ? relative(nextDue.due_at) : ''}</div>
        </div>
        <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div class="text-[10px] uppercase tracking-[0.08em] text-zinc-400 mb-1">Upcoming</div>
          <div class="text-xl font-semibold">{upcoming.length}</div>
          <div class="text-[11px] text-zinc-500 mt-0.5">due soon</div>
        </div>
        <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div class="text-[10px] uppercase tracking-[0.08em] text-zinc-400 mb-1">Latest news</div>
          <div class="text-sm font-medium truncate">{latestAnnouncement ? latestAnnouncement.title : 'No announcements'}</div>
          <div class="text-[11px] text-zinc-500 mt-0.5">{latestAnnouncement?.posted_at ? relativePast(latestAnnouncement.posted_at) : ''}</div>
        </div>
      </div>

      <!-- Quick links -->
      <div class="flex flex-wrap gap-1.5 mb-8">
        {#each quickLinks as link}
          <a href={`/courses/${courseId}/${link.href}`}
             class="px-3 py-1.5 text-[11px] font-medium rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-[var(--pb-brand)] hover:text-[var(--pb-brand-strong)] transition-colors">
            {link.label}
          </a>
        {/each}
      </div>

      <!-- Upcoming + Announcements two-column -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section>
          <div class="text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-500 mb-2">Upcoming</div>
          <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-hidden">
            {#each upcoming as a (a.id)}
              <a href={`/courses/${courseId}/assignments/${a.id}`} class="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                <div class="text-sm font-medium truncate">{a.name}</div>
                <div class="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                  <span>{relative(a.due_at)}</span>
                  <span>·</span>
                  <span>{a.points_possible ?? 0} pts</span>
                </div>
              </a>
            {:else}
              <div class="px-4 py-8 text-center text-xs text-zinc-400">Nothing upcoming.</div>
            {/each}
          </div>
        </section>
        <section>
          <div class="text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-500 mb-2">Announcements</div>
          <div class="space-y-2">
            {#each announcements as a (a.id)}
              <a href={`/courses/${courseId}/discussion_topics/${a.id}`} class="block rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                <div class="flex items-baseline gap-2 mb-1">
                  <h3 class="text-sm font-medium truncate flex-1">{a.title}</h3>
                  <span class="text-[10px] text-zinc-400 flex-shrink-0">{relativePast(a.posted_at)}</span>
                </div>
                <p class="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">{preview(a.message ?? '')}</p>
              </a>
            {:else}
              <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-8 text-center text-xs text-zinc-400">No announcements yet.</div>
            {/each}
          </div>
        </section>
      </div>

      <!-- Syllabus preview -->
      {#if course.syllabus_body}
        <section class="mt-8">
          <div class="text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-500 mb-2 flex items-center justify-between">
            <span>Syllabus</span>
            <a href={`/courses/${courseId}/assignments/syllabus`} class="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 normal-case tracking-normal">View full →</a>
          </div>
          <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 prose prose-sm dark:prose-invert max-w-none max-h-48 overflow-hidden relative">
            {@html course.syllabus_body}
            <div class="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-zinc-900 to-transparent"></div>
          </div>
        </section>
      {/if}
    {/if}
  </div>
</div>
