<script lang="ts">
  import { onMount } from 'svelte';
  import CourseNav from '../course-nav/CourseNav.svelte';
  import { fetchDiscussions } from './api';
  import type { DiscussionTopic } from '../../lib/types';

  type DiscussionTopicEx = DiscussionTopic & {
    pinned?: boolean;
    locked?: boolean;
    read_state?: 'read' | 'unread';
    last_reply_at?: string;
  };

  let { courseId }: { courseId: number } = $props();

  let items = $state<DiscussionTopicEx[]>([]);
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let sortBy = $state<'recent' | 'replies' | 'pinned'>('recent');

  onMount(async () => {
    try {
      items = (await fetchDiscussions(courseId)) as DiscussionTopicEx[];
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });

  function preview(html: string, max = 180): string {
    const t = (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max) + '…' : t;
  }

  function relative(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const ms = Date.now() - d.getTime();
    const days = Math.floor(ms / 86_400_000);
    if (days < 1) {
      const h = Math.floor(ms / 3_600_000);
      return h < 1 ? 'just now' : `${h}h ago`;
    }
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: days > 365 ? 'numeric' : undefined });
  }

  function initials(name?: string): string {
    if (!name) return '?';
    return name.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
  }

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    let list = items;
    if (q) list = list.filter(a =>
      a.title.toLowerCase().includes(q) ||
      preview(a.message ?? '').toLowerCase().includes(q)
    );
    const sorted = [...list];
    if (sortBy === 'recent') {
      sorted.sort((a, b) => (b.posted_at ?? '').localeCompare(a.posted_at ?? ''));
    } else if (sortBy === 'replies') {
      sorted.sort((a, b) => (b.discussion_subentry_count ?? 0) - (a.discussion_subentry_count ?? 0));
    } else if (sortBy === 'pinned') {
      sorted.sort((a, b) => {
        const ap = a.pinned ? 1 : 0;
        const bp = b.pinned ? 1 : 0;
        if (ap !== bp) return bp - ap;
        return (b.posted_at ?? '').localeCompare(a.posted_at ?? '');
      });
    }
    return sorted;
  });
</script>

<div class="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
  <CourseNav {courseId} />
  <div class="max-w-3xl mx-auto px-6 py-8">
    <header class="mb-6">
      <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-zinc-400 mb-2">
        <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
        Discussions
        <span class="text-zinc-300 dark:text-zinc-700">·</span>
        <span>{filtered.length}</span>
      </div>
      <h1 class="text-2xl font-semibold tracking-tight">Discussions</h1>
    </header>

    <div class="flex items-center gap-2 mb-5 flex-wrap">
      <div class="relative flex-1 min-w-[200px]">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
        <input bind:value={search} placeholder="Search discussions…"
               class="w-full pl-9 pr-3 py-1.5 text-xs rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-[var(--pb-brand)] focus:border-transparent placeholder:text-zinc-400" />
      </div>
      <div class="flex items-center text-[11px] rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {#each [['recent','Recent'],['replies','Most replies'],['pinned','Pinned first']] as const as [v, label]}
          <button class={`px-2.5 py-1.5 ${sortBy === v ? '' : 'bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500'}`}
                  style={sortBy === v ? 'background: var(--pb-brand); color: var(--pb-brand-fg);' : ''}
                  onclick={() => sortBy = v}>{label}</button>
        {/each}
      </div>
    </div>

    {#if loading}
      <div class="py-16 text-center text-sm text-zinc-400">Loading discussions…</div>
    {:else if error}
      <div class="rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
    {:else if filtered.length === 0}
      <div class="py-16 text-center text-sm text-zinc-400">{search ? `No matches for "${search}".` : 'No discussions yet.'}</div>
    {:else}
      <div class="space-y-3">
        {#each filtered as a (a.id)}
          <a href={`/courses/${courseId}/discussion_topics/${a.id}`}
             class="block group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold" style="background: color-mix(in srgb, var(--pb-brand) 14%, transparent); color: var(--pb-brand-strong);">{initials(a.author?.display_name)}</div>
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline gap-2 mb-1 flex-wrap">
                  {#if a.pinned}
                    <span class="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" style="background: color-mix(in srgb, var(--pb-brand) 14%, transparent); color: var(--pb-brand-strong);">Pinned</span>
                  {/if}
                  {#if a.locked}
                    <span class="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">Locked</span>
                  {/if}
                  <h3 class="text-sm font-semibold truncate group-hover:underline flex-1">{a.title}</h3>
                  <span class="text-[11px] text-zinc-400 flex-shrink-0">{a.posted_at ? relative(a.posted_at) : ''}</span>
                </div>
                <div class="flex items-center gap-2 text-[11px] text-zinc-500 mb-2">
                  {#if a.author?.display_name}
                    <span>{a.author.display_name}</span>
                  {/if}
                  {#if (a.discussion_subentry_count ?? 0) > 0}
                    <span>·</span>
                    <span>{a.discussion_subentry_count} {a.discussion_subentry_count === 1 ? 'reply' : 'replies'}</span>
                  {/if}
                </div>
                <p class="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2">{preview(a.message ?? '')}</p>
              </div>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>
