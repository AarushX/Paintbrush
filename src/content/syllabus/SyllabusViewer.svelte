<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchSyllabusCourse, fetchSyllabusAssignments } from './api';
  import type { SyllabusCourse, SyllabusAssignment } from './api';

  let { courseId }: { courseId: number } = $props();

  let course = $state<SyllabusCourse | null>(null);
  let assignments = $state<SyllabusAssignment[]>([]);
  let loading = $state(true);
  let error = $state('');

  onMount(async () => {
    try {
      const [c, a] = await Promise.all([
        fetchSyllabusCourse(courseId),
        fetchSyllabusAssignments(courseId).catch(() => [] as SyllabusAssignment[])
      ]);
      course = c;
      assignments = a;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });

  // Dated assignments form the course schedule, grouped by month.
  const schedule = $derived.by(() => {
    const dated = assignments
      .filter(a => !!a.due_at)
      .sort((x, y) => (x.due_at ?? '').localeCompare(y.due_at ?? ''));
    const groups: Array<{ label: string; items: SyllabusAssignment[] }> = [];
    for (const a of dated) {
      const d = new Date(a.due_at!);
      const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      let g = groups[groups.length - 1];
      if (!g || g.label !== label) { g = { label, items: [] }; groups.push(g); }
      g.items.push(a);
    }
    return groups;
  });

  function fmtDay(iso?: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function fmtTime(iso?: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
</script>

<div class="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
  <div class="max-w-5xl mx-auto px-6 py-8">
    {#if loading}
      <div class="py-16 text-center text-sm text-zinc-400">Loading syllabus…</div>
    {:else if error}
      <div class="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
    {:else if course}
      <header class="mb-6 pb-6 border-b border-zinc-200 dark:border-zinc-800/50">
        <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-zinc-400 mb-2">
          <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
          {course.course_code ?? 'Course'}
          <span class="text-zinc-300 dark:text-zinc-700">·</span>
          <span>Syllabus</span>
        </div>
        <h1 class="text-2xl font-semibold tracking-tight">Syllabus</h1>
        <p class="text-sm text-zinc-500 mt-1">{course.name}</p>
      </header>

      <!-- Syllabus body -->
      {#if course.syllabus_body && course.syllabus_body.trim()}
        <div class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 prose prose-sm dark:prose-invert max-w-none mb-8">
          {@html course.syllabus_body}
        </div>
      {:else}
        <div class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-12 text-center text-sm text-zinc-400 mb-8">
          This course has no written syllabus.
        </div>
      {/if}

      <!-- Course schedule -->
      {#if schedule.length > 0}
        <section>
          <div class="text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-500 mb-3">Course schedule</div>
          <div class="space-y-5">
            {#each schedule as group (group.label)}
              <div>
                <div class="text-[11px] font-semibold text-zinc-400 mb-1.5">{group.label}</div>
                <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-hidden">
                  {#each group.items as a (a.id)}
                    <a href={a.html_url ?? `/courses/${courseId}/assignments/${a.id}`}
                       class="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <div class="w-16 flex-shrink-0 text-[11px] font-medium text-zinc-500">{fmtDay(a.due_at)}</div>
                      <div class="min-w-0 flex-1">
                        <div class="text-sm font-medium truncate">{a.name}</div>
                        {#if a.due_at}<div class="text-[11px] text-zinc-400">Due {fmtTime(a.due_at)}</div>{/if}
                      </div>
                      {#if a.points_possible != null}
                        <span class="text-[11px] text-zinc-400 flex-shrink-0">{a.points_possible} pts</span>
                      {/if}
                    </a>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}
    {/if}
  </div>
</div>
