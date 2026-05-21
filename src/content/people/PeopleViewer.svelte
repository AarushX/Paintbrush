<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchPeople, fetchSections } from './api';
  import type { CanvasUser, Section } from '../../lib/types';

  let { courseId }: { courseId: number } = $props();

  let users = $state<CanvasUser[]>([]);
  let sections = $state<Section[]>([]);
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let roleFilter = $state<'all' | 'student' | 'teacher' | 'ta' | 'observer' | 'designer'>('all');
  let sectionFilter = $state<number | null>(null);
  let copiedEmail = $state<string | null>(null);

  onMount(async () => {
    try {
      const [u, s] = await Promise.all([
        fetchPeople(courseId),
        fetchSections(courseId).catch(() => [] as Section[])
      ]);
      users = u;
      sections = s;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });

  function rolesOf(u: CanvasUser): string[] {
    return (u.enrollments ?? []).map(e => {
      switch (e.type) {
        case 'StudentEnrollment': return 'student';
        case 'TeacherEnrollment': return 'teacher';
        case 'TaEnrollment': return 'ta';
        case 'DesignerEnrollment': return 'designer';
        case 'ObserverEnrollment': return 'observer';
        default: return 'other';
      }
    });
  }

  function primaryRoleLabel(u: CanvasUser): string {
    const roles = rolesOf(u);
    if (roles.includes('teacher')) return 'Teacher';
    if (roles.includes('ta')) return 'TA';
    if (roles.includes('designer')) return 'Designer';
    if (roles.includes('observer')) return 'Observer';
    if (roles.includes('student')) return 'Student';
    return 'Member';
  }

  function initials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
  }

  function matchesSearch(u: CanvasUser, q: string): boolean {
    if (!q) return true;
    const n = q.toLowerCase();
    return u.name.toLowerCase().includes(n) ||
      (u.email?.toLowerCase().includes(n) ?? false) ||
      (u.short_name?.toLowerCase().includes(n) ?? false);
  }

  function matchesRole(u: CanvasUser, f: typeof roleFilter): boolean {
    if (f === 'all') return true;
    return rolesOf(u).includes(f);
  }

  function matchesSection(u: CanvasUser, sid: number | null): boolean {
    if (sid == null) return true;
    return (u.enrollments ?? []).some(e => (e.section_id ?? e.course_section_id) === sid);
  }

  const filtered = $derived(users.filter(u =>
    matchesSearch(u, search) &&
    matchesRole(u, roleFilter) &&
    matchesSection(u, sectionFilter)
  ));

  // Teachers first, then TAs, then designers (stable within each rank).
  function teamRank(u: CanvasUser): number {
    const r = rolesOf(u);
    if (r.includes('teacher')) return 0;
    if (r.includes('ta')) return 1;
    return 2;
  }
  const teachingTeam = $derived(
    filtered
      .filter(u => {
        const r = rolesOf(u);
        return r.includes('teacher') || r.includes('ta');
      })
      .slice()
      .sort((a, b) => teamRank(a) - teamRank(b))
  );

  const others = $derived(filtered.filter(u => {
    const r = rolesOf(u);
    return !r.includes('teacher') && !r.includes('ta');
  }));

  const counts = $derived.by(() => {
    let s = 0, t = 0, ta = 0;
    for (const u of users) {
      const r = rolesOf(u);
      if (r.includes('teacher')) t++;
      else if (r.includes('ta')) ta++;
      else if (r.includes('student')) s++;
    }
    return { s, t, ta };
  });

  async function copyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      copiedEmail = email;
      setTimeout(() => { if (copiedEmail === email) copiedEmail = null; }, 1500);
    } catch {}
  }
</script>

<div class="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
  <div class="max-w-3xl mx-auto px-6 py-8">
    <header class="mb-6">
      <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-zinc-400 mb-2">
        <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
        People
        <span class="text-zinc-300 dark:text-zinc-700">·</span>
        <span>{counts.s} students · {counts.t} teachers · {counts.ta} TAs</span>
      </div>
      <h1 class="text-2xl font-semibold tracking-tight">People</h1>
    </header>

    <div class="flex items-center gap-2 mb-5 flex-wrap">
      <div class="relative flex-1 min-w-[200px]">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
        <input bind:value={search} placeholder="Search names or emails…"
               class="w-full pl-9 pr-3 py-1.5 text-xs rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-[var(--pb-brand)] focus:border-transparent placeholder:text-zinc-400" />
      </div>
      <div class="flex items-center text-[11px] rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {#each ([['all', 'All'], ['teacher', 'Teachers'], ['ta', 'TAs'], ['student', 'Students']] as const) as [v, label]}
          <button class={`px-2.5 py-1.5 ${roleFilter === v ? '' : 'bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500'}`}
                  style={roleFilter === v ? 'background: var(--pb-brand); color: var(--pb-brand-fg);' : ''}
                  onclick={() => roleFilter = v}>{label}</button>
        {/each}
      </div>
      {#if sections.length > 1}
        <select bind:value={sectionFilter} class="px-2.5 py-1.5 text-[11px] rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <option value={null}>All sections</option>
          {#each sections as s}<option value={s.id}>{s.name}</option>{/each}
        </select>
      {/if}
    </div>

    {#if loading}
      <div class="py-16 text-center text-sm text-zinc-400">Loading people…</div>
    {:else if error}
      <div class="rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
    {:else}
      {#if teachingTeam.length > 0 && roleFilter !== 'student'}
        <div class="mb-6">
          <div class="text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-500 mb-2">Teaching team</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {#each teachingTeam as u (u.id)}
              <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex gap-3">
                {#if u.avatar_url}
                  <img src={u.avatar_url} alt="" class="w-12 h-12 rounded-full object-cover bg-zinc-100 dark:bg-zinc-800 flex-shrink-0" loading="lazy" />
                {:else}
                  <div class="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0" style="background: color-mix(in srgb, var(--pb-brand) 14%, transparent); color: var(--pb-brand-strong);">{initials(u.name)}</div>
                {/if}
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline gap-2">
                    <h3 class="text-sm font-semibold truncate">{u.name}</h3>
                    {#if u.pronouns}<span class="text-[10px] text-zinc-400">({u.pronouns})</span>{/if}
                  </div>
                  <div class="text-[11px] uppercase tracking-wider font-medium mt-0.5" style="color: var(--pb-brand-strong);">{primaryRoleLabel(u)}</div>
                  {#if u.email}
                    <div class="flex items-center gap-1 mt-1.5">
                      <a href={`mailto:${u.email}`} class="text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 truncate">{u.email}</a>
                      <button onclick={() => copyEmail(u.email!)} class="text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 px-1" title="Copy">
                        {copiedEmail === u.email ? '✓' : '⧉'}
                      </button>
                    </div>
                  {/if}
                  {#if u.bio}
                    <p class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-2">{u.bio}</p>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if others.length > 0}
        <div>
          {#if teachingTeam.length > 0 && roleFilter !== 'student'}
            <div class="text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-500 mb-2">Everyone else</div>
          {/if}
          <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-hidden">
            {#each others as u (u.id)}
              <div class="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                {#if u.avatar_url}
                  <img src={u.avatar_url} alt="" class="w-9 h-9 rounded-full object-cover bg-zinc-100 dark:bg-zinc-800 flex-shrink-0" loading="lazy" />
                {:else}
                  <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0" style="background: color-mix(in srgb, var(--pb-brand) 14%, transparent); color: var(--pb-brand-strong);">{initials(u.name)}</div>
                {/if}
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline gap-2">
                    <span class="text-sm font-medium truncate">{u.name}</span>
                    {#if u.pronouns}<span class="text-[10px] text-zinc-400">({u.pronouns})</span>{/if}
                  </div>
                  <div class="text-[11px] text-zinc-500 truncate">{primaryRoleLabel(u)}</div>
                </div>
                {#if u.email}
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <a href={`mailto:${u.email}`} class="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 truncate max-w-[180px] hidden sm:block">{u.email}</a>
                    <button onclick={() => copyEmail(u.email!)} class="text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 px-1.5 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Copy email">
                      {copiedEmail === u.email ? '✓' : '⧉'}
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if filtered.length === 0}
        <div class="py-16 text-center text-sm text-zinc-400">{search ? `No matches for "${search}".` : 'No one yet.'}</div>
      {/if}
    {/if}
  </div>
</div>
